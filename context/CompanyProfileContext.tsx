"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchCompanyProfile, saveCompanyProfile, type BidderIdentity, type CompanyProfile } from "@/lib/api";

/**
 * The bidder's own identity, looked up once — on Eligibilitate, or by CUI in
 * Redactare — and reused in every document header after that. It used to be
 * re-typed on every page that needed it.
 *
 * Two copies, on purpose: localStorage so it is there instantly and works
 * signed-out or offline, and the server (company_profiles) so it follows the
 * account to another device. The newer of the two wins on load.
 */
const STORAGE_KEY = "ro_intel_company_profile";

interface CompanyProfileContextValue {
  profile: CompanyProfile | null;
  /** Merges and persists. `source` only labels where it came from. */
  save: (patch: CompanyProfile) => Promise<void>;
  clear: () => void;
  /** The same identity in the shape the drafting endpoints take. */
  bidder: BidderIdentity | null;
}

const CompanyProfileContext = createContext<CompanyProfileContextValue>({
  profile: null,
  save: async () => {},
  clear: () => {},
  bidder: null,
});

function readLocal(): CompanyProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CompanyProfile) : null;
  } catch {
    return null;
  }
}

function writeLocal(profile: CompanyProfile | null) {
  try {
    if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(STORAGE_KEY);
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
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    setProfile(readLocal());
  }, []);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    fetchCompanyProfile()
      .then(({ profile: remote }) => {
        if (!mounted || !remote) return;
        const local = readLocal();
        const remoteNewer = !local?.updated_at || (remote.updated_at && remote.updated_at > local.updated_at);
        if (remoteNewer && (remote.company_name || remote.cui)) {
          writeLocal(remote);
          setProfile(remote);
        } else if (local && (local.company_name || local.cui) && !remote.cui) {
          // Looked up before signing in: carry it to the account.
          saveCompanyProfile(local).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [user]);

  // The form that edits this saves per keystroke; the browser copy keeps
  // up, the server gets the settled value.
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = useCallback(
    async (patch: CompanyProfile) => {
      const next = { ...(readLocal() || {}), ...patch, updated_at: new Date().toISOString() };
      writeLocal(next);
      setProfile(next);
      if (!user) return;
      if (serverTimer.current) clearTimeout(serverTimer.current);
      serverTimer.current = setTimeout(() => {
        saveCompanyProfile(next).catch(() => {
          // The local copy stands; it will be offered to the server next load.
        });
      }, 900);
    },
    [user]
  );

  const clear = useCallback(() => {
    writeLocal(null);
    setProfile(null);
  }, []);

  const value = useMemo(() => ({ profile, save, clear, bidder: toBidder(profile) }), [profile, save, clear]);
  return <CompanyProfileContext.Provider value={value}>{children}</CompanyProfileContext.Provider>;
}

export function useCompanyProfile() {
  return useContext(CompanyProfileContext);
}
