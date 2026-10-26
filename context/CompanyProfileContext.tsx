"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  activateCompany,
  addCompanyToLibrary,
  deleteCompanyFromLibrary,
  fetchCompanyLibrary,
  fetchCompanyProfile,
  saveCompanyProfile,
  type BidderIdentity,
  type CompanyProfile,
} from "@/lib/api";
import { userKey } from "@/lib/userStorage";

/**
 * The bidder's own identity, looked up once — on Eligibilitate, or by CUI in
 * Redactare — and reused in every document header after that. It used to be
 * re-typed on every page that needed it.
 *
 * Two copies, on purpose: localStorage so it is there instantly, and the
 * server (company_profiles), which is authoritative and follows the account
 * to another device. The browser copy is keyed by user id and removed on
 * sign-out (lib/userStorage.ts), so one person's identity never appears in
 * — or gets uploaded into — another person's account on a shared computer.
 */
const STORAGE_BASE = "ro_intel_company_profile";

interface CompanyProfileContextValue {
  /** The ACTIVE bidder — the "Subscrisa" of every document. Redactare,
   *  Eligibilitate and Setări all read and write it here, nowhere else. */
  profile: CompanyProfile | null;
  /** Merges and persists. */
  save: (patch: CompanyProfile) => Promise<void>;
  clear: () => void;
  /** The same identity in the shape the drafting endpoints take. */
  bidder: BidderIdentity | null;
  /** Multi-CUI (Ofertant Complet Pro): every saved firm, the active one
   *  included, and the plan's limit. One firm on the other plans. */
  library: CompanyProfile[];
  libraryMax: number;
  /** Makes a saved firm the active bidder. */
  activate: (cui: string) => Promise<{ error: string | null }>;
  /** Saves another firm without switching to it. */
  addCompany: (profile: CompanyProfile) => Promise<{ error: string | null }>;
  removeCompany: (cui: string) => Promise<{ error: string | null }>;
}

const CompanyProfileContext = createContext<CompanyProfileContextValue>({
  profile: null,
  save: async () => {},
  clear: () => {},
  bidder: null,
  library: [],
  libraryMax: 1,
  activate: async () => ({ error: null }),
  addCompany: async () => ({ error: null }),
  removeCompany: async () => ({ error: null }),
});

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : "Operația nu a reușit. Reîncercați.";
}

function readLocal(userId?: string | null): CompanyProfile | null {
  try {
    const raw = localStorage.getItem(userKey(STORAGE_BASE, userId));
    return raw ? (JSON.parse(raw) as CompanyProfile) : null;
  } catch {
    return null;
  }
}

function writeLocal(profile: CompanyProfile | null, userId?: string | null) {
  try {
    const key = userKey(STORAGE_BASE, userId);
    if (profile) localStorage.setItem(key, JSON.stringify(profile));
    else localStorage.removeItem(key);
  } catch {
    // Private mode or blocked storage: the server copy still works.
  }
}

export function toBidder(p: CompanyProfile | null): BidderIdentity | null {
  if (!p || !(p.company_name || p.cui)) return null;
  return {
    company_name: p.company_name || undefined,
    cui: p.cui || undefined,
    trade_register_no: p.registration_number || undefined,
    headquarters: p.address || undefined,
    legal_representative: p.legal_representative || undefined,
    representative_role: p.representative_role || undefined,
  };
}

export function CompanyProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.user_id || null;
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [library, setLibrary] = useState<CompanyProfile[]>([]);
  const [libraryMax, setLibraryMax] = useState(1);

  const refreshLibrary = useCallback(() => {
    if (!userId) {
      setLibrary([]);
      setLibraryMax(1);
      return Promise.resolve();
    }
    return fetchCompanyLibrary()
      .then((lib) => {
        setLibrary(lib.profiles || []);
        setLibraryMax(lib.max || 1);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  // This account's browser copy, instantly; then the server's, which wins
  // when it is newer. A copy left by someone else is never read (other
  // key) and never uploaded into this account.
  useEffect(() => {
    setProfile(readLocal(userId));
    if (!userId) return;
    let mounted = true;
    fetchCompanyProfile()
      .then(({ profile: remote }) => {
        if (!mounted || !remote) return;
        const local = readLocal(userId);
        const remoteNewer = !local?.updated_at || (remote.updated_at && remote.updated_at > local.updated_at);
        if (remoteNewer && (remote.company_name || remote.cui)) {
          writeLocal(remote, userId);
          setProfile(remote);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [userId]);

  // The form that edits this saves per keystroke; the browser copy keeps
  // up, the server gets the settled value.
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = useCallback(
    async (patch: CompanyProfile) => {
      const prev = readLocal(userId) || {};
      // A different company — new CUI *and* new name, which is what an ANAF
      // lookup of another firm produces (a typo fixed in the CUI field
      // changes only the first). The representative typed for the previous
      // company is not registry data and would otherwise sign the new one's
      // documents, so it is cleared unless this save names a new one.
      const digits = (v?: string | null) => (v || "").replace(/\D/g, "");
      const name = (v?: string | null) => (v || "").trim().toLowerCase();
      const otherCompany =
        digits(patch.cui) !== "" &&
        digits(patch.cui) !== digits(prev.cui) &&
        name(patch.company_name) !== "" &&
        name(patch.company_name) !== name(prev.company_name);
      const next: CompanyProfile = { ...prev, ...patch, updated_at: new Date().toISOString() };
      const repUnchanged = patch.legal_representative === undefined || patch.legal_representative === prev.legal_representative;
      if (otherCompany && repUnchanged) {
        next.legal_representative = null;
        next.representative_role = null;
      }
      writeLocal(next, userId);
      setProfile(next);
      if (!userId) return;
      if (serverTimer.current) clearTimeout(serverTimer.current);
      serverTimer.current = setTimeout(() => {
        saveCompanyProfile(next).then(() => refreshLibrary()).catch(() => {
          // The local copy stands; it will be offered to the server next load.
        });
      }, 900);
    },
    [userId, refreshLibrary]
  );

  const activate = useCallback(
    async (cui: string) => {
      try {
        const { profile: active } = await activateCompany(cui);
        const next = { ...active, updated_at: new Date().toISOString() };
        writeLocal(next, userId);
        setProfile(next);
        await refreshLibrary();
        return { error: null };
      } catch (e) {
        return { error: errorText(e) };
      }
    },
    [userId, refreshLibrary]
  );

  const addCompany = useCallback(
    async (p: CompanyProfile) => {
      try {
        await addCompanyToLibrary(p);
        await refreshLibrary();
        return { error: null };
      } catch (e) {
        return { error: errorText(e) };
      }
    },
    [refreshLibrary]
  );

  const removeCompany = useCallback(
    async (cui: string) => {
      try {
        await deleteCompanyFromLibrary(cui);
        await refreshLibrary();
        return { error: null };
      } catch (e) {
        return { error: errorText(e) };
      }
    },
    [refreshLibrary]
  );

  const clear = useCallback(() => {
    writeLocal(null, userId);
    setProfile(null);
  }, [userId]);

  const value = useMemo(
    () => ({ profile, save, clear, bidder: toBidder(profile), library, libraryMax, activate, addCompany, removeCompany }),
    [profile, save, clear, library, libraryMax, activate, addCompany, removeCompany]
  );
  return <CompanyProfileContext.Provider value={value}>{children}</CompanyProfileContext.Provider>;
}

export function useCompanyProfile() {
  return useContext(CompanyProfileContext);
}
