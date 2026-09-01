"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { syncBackendAuth, completeOnboarding as apiCompleteOnboarding, ApiError, type OnboardingProfile } from "@/lib/api";

export interface BusinessDivision {
  id: string;
  name: string;
  keywords: string[];
}

export interface BusinessDesk {
  id: string;
  name: string;
  /**
   * Optional. Left over from when every account was a company — most
   * individual users have no CUI to give. Still accepted (and used to
   * prefill the legal-document tools under /eligibility and /drafting)
   * for the minority of users monitoring on behalf of a registered firm.
   */
  cui?: string;
  primary_domain: string;
  target_counties: string[];
  min_budget_ron: number;
  keywords: string[];
  divisions: BusinessDivision[];
  /**
   * The backend intelligence profile this desk is matched against.
   *
   * Desks are a browser-local concept (see below) but matching is not:
   * matching_engine.evaluate_opportunity_for_tenant fails closed on an
   * unrecognised tenant id. The app used to pass the desk's own local id
   * (`desk_main_infra`) straight through as the tenant id, which matched
   * nothing at all — every feed request came back with zero leads and the
   * UI sat on an empty state forever. Every desk must therefore carry a
   * real key from GET /api/v1/tenants.
   */
  tenant_id: string;
}

/** Real keys from matching_engine.TENANT_ORGANIZATIONS. */
export const BACKEND_TENANTS = {
  infrastructura: "t1_infra_transilvania",
  sanatate: "t2_medtech_bucuresti",
  energie: "t3_vest_consulting_grants",
} as const;

export const DEFAULT_TENANT_ID = BACKEND_TENANTS.infrastructura;

/**
 * Maps a desk's chosen strategic domain onto the closest backend profile.
 * `aparare` and `digitalizare` have no dedicated profile yet, so they fall
 * back to the infrastructure desk — which is where their keyword sets
 * (ITS, smart city, surveillance) actually live in TENANT_ORGANIZATIONS.
 */
export function tenantIdForDomain(domain: string): string {
  return BACKEND_TENANTS[domain as keyof typeof BACKEND_TENANTS] ?? DEFAULT_TENANT_ID;
}

export interface UserProfile {
  user_id?: string;
  email: string;
  full_name: string;
  /** The one real backend tenant this signed-in user is provisioned to. */
  tenant_id: string;
  role: string;
  avatar_url?: string;
  is_subscribed?: boolean;
}

export interface UserPreferences {
  notification_email?: string;
  /**
   * Mirrored locally only so the Settings field can be repopulated on
   * reopen — the authoritative copy is tenants.telegram_chat_id in
   * Postgres, which is what notifier.py actually dispatches against.
   */
  telegram_chat_id?: string;
  auto_alert_score: number;
  default_sort: "score_desc" | "budget_desc" | "date_desc" | "deadline_asc";
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  /** Set when the backend rejected the session — surfaced in the UI. */
  authError: string | null;
  /**
   * True when the session itself is valid but this account has no tenant
   * yet — a new individual subscriber who hasn't set up their watch
   * profile. Distinct from authError: this is not a failure, it's the
   * one-time setup step AuthGate shows instead of a dead end.
   */
  needsOnboarding: boolean;
  /** Creates this user's own tenant/product and adopts the resulting session. */
  completeOnboarding: (profile: OnboardingProfile) => Promise<{ error: string | null }>;
  preferences: UserPreferences;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => void;
  desks: BusinessDesk[];
  activeDesk: BusinessDesk;
  /** The id to send to the backend for the active desk. */
  activeTenantId: string;
  createDesk: (desk: Omit<BusinessDesk, "id">) => void;
  updateDesk: (id: string, desk: Partial<BusinessDesk>) => void;
  deleteDesk: (id: string) => void;
  switchDesk: (id: string) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const DEFAULT_DESKS: BusinessDesk[] = [
  {
    id: "desk_main_infra",
    tenant_id: BACKEND_TENANTS.infrastructura,
    name: "Infrastructură & Transporturi",
    primary_domain: "infrastructura",
    target_counties: ["Cluj", "Iasi", "Bihor", "Timis", "Bucuresti", "Brasov", "Constanta"],
    min_budget_ron: 5000000,
    keywords: ["drum", "pod", "pasaj", "asfalt", "its", "scats", "semaforizare", "metrou"],
    divisions: [
      { id: "div_heavy", name: "Infrastructura Grea si Drumuri", keywords: ["drum", "pod", "asfalt", "metrou"] },
      { id: "div_its", name: "Smart City si Sisteme ITS", keywords: ["its", "scats", "semaforizare", "anpr"] },
    ],
  },
  {
    id: "desk_medtech",
    tenant_id: BACKEND_TENANTS.sanatate,
    name: "Sănătate & Echipamente Medicale",
    primary_domain: "sanatate",
    target_counties: ["Bucuresti", "Iasi", "Cluj", "Timis", "Brasov"],
    min_budget_ron: 3000000,
    keywords: ["rmn", "ct", "accelerator", "radioterapie", "spital", "oncologie", "pacs"],
    divisions: [
      { id: "div_imagistica", name: "Imagistica Medicala si RMN", keywords: ["rmn", "ct", "radioterapie"] },
      { id: "div_digital_health", name: "Digitalizare Spitale PACS", keywords: ["pacs", "soft medical"] },
    ],
  },
];

const DEFAULT_PREFERENCES: UserPreferences = {
  notification_email: "",
  auto_alert_score: 9.0,
  default_sort: "score_desc",
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  authError: null,
  needsOnboarding: false,
  completeOnboarding: async () => ({ error: null }),
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: () => {},
  desks: DEFAULT_DESKS,
  activeDesk: DEFAULT_DESKS[0],
  activeTenantId: DEFAULT_TENANT_ID,
  createDesk: () => {},
  updateDesk: () => {},
  deleteDesk: () => {},
  switchDesk: () => {},
  signInWithGoogle: async () => {},
  signInWithEmail: async () => ({ error: null }),
  signOut: async () => {},
});

/**
 * Desks saved before tenant binding existed have no tenant_id (or carry
 * their own local id in that slot). Repair them on read rather than
 * dropping the user's saved desks — an unrepaired desk produces a
 * permanently empty feed with no visible error.
 */
function migrateDesks(saved: unknown): BusinessDesk[] | null {
  if (!Array.isArray(saved) || saved.length === 0) return null;
  const valid = Object.values(BACKEND_TENANTS) as string[];
  return saved.map((d: Partial<BusinessDesk>) => ({
    ...(d as BusinessDesk),
    tenant_id:
      d.tenant_id && valid.includes(d.tenant_id) ? d.tenant_id : tenantIdForDomain(d.primary_domain || "infrastructura"),
  }));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [desks, setDesks] = useState<BusinessDesk[]>(DEFAULT_DESKS);
  const [activeDeskId, setActiveDeskId] = useState<string>(DEFAULT_DESKS[0].id);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedDesks = localStorage.getItem("ro_intel_user_desks");
      if (savedDesks) {
        const migrated = migrateDesks(JSON.parse(savedDesks));
        if (migrated) {
          setDesks(migrated);
          localStorage.setItem("ro_intel_user_desks", JSON.stringify(migrated));
        }
      }
      const savedActiveId = localStorage.getItem("ro_intel_active_desk_id");
      if (savedActiveId) setActiveDeskId(savedActiveId);
      const savedPrefs = localStorage.getItem("ro_intel_user_prefs");
      if (savedPrefs) setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(savedPrefs) });
    } catch {
      /* corrupt localStorage — fall back to defaults rather than crashing */
    }
  }, []);

  const saveDesksToStorage = (updatedDesks: BusinessDesk[]) => {
    setDesks(updatedDesks);
    if (typeof window !== "undefined") {
      localStorage.setItem("ro_intel_user_desks", JSON.stringify(updatedDesks));
    }
  };

  const switchDesk = useCallback((id: string) => {
    setActiveDeskId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("ro_intel_active_desk_id", id);
    }
  }, []);

  const createDesk = (deskData: Omit<BusinessDesk, "id">) => {
    const newDesk: BusinessDesk = {
      ...deskData,
      id: "desk_" + Date.now(),
      // A signed-in user may only ever be provisioned to one real backend
      // tenant (security.require_tenant_membership now 403s any other),
      // so every desk they create is stamped with it here regardless of
      // what tenant_id the caller (WorkspaceDeskModal's domain -> tenant
      // lookup) computed — enforced once, in the one place a desk object
      // is actually constructed, rather than trusted at every call site.
      tenant_id: user?.tenant_id || deskData.tenant_id,
    };
    saveDesksToStorage([...desks, newDesk]);
    switchDesk(newDesk.id);
  };

  const updateDesk = (id: string, deskData: Partial<BusinessDesk>) => {
    saveDesksToStorage(
      desks.map((d) =>
        d.id === id ? { ...d, ...deskData, tenant_id: user?.tenant_id || deskData.tenant_id || d.tenant_id } : d
      )
    );
  };

  const deleteDesk = (id: string) => {
    if (desks.length <= 1) return;
    const updated = desks.filter((d) => d.id !== id);
    saveDesksToStorage(updated);
    if (activeDeskId === id) switchDesk(updated[0].id);
  };

  const updatePreferences = (newPrefs: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };
      if (typeof window !== "undefined") {
        localStorage.setItem("ro_intel_user_prefs", JSON.stringify(updated));
      }
      return updated;
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function adoptSession(session: { user: { email?: string; user_metadata?: Record<string, string> } } | null) {
      if (!session?.user) {
        if (!cancelled) {
          setUser(null);
          setAuthError(null);
          setNeedsOnboarding(false);
        }
        return;
      }
      const authUser = session.user;
      try {
        const synced = await syncBackendAuth(
          authUser.email || "",
          authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split("@")[0],
          authUser.user_metadata?.avatar_url
        );
        if (cancelled || !synced?.user) return;
        if (!synced.user.tenant_id) {
          // Signed in successfully, but this individual hasn't set up their
          // own watch profile yet. This is not a rejected session — there
          // is no admin to contact in a self-serve product — so AuthGate
          // shows an onboarding form instead of a dead end.
          setUser(null);
          setAuthError(null);
          setNeedsOnboarding(true);
          return;
        }
        setNeedsOnboarding(false);
        setUser({ ...synced.user, tenant_id: synced.user.tenant_id, is_subscribed: true });
        setAuthError(null);
      } catch (err) {
        // The backend rejecting a session is a real, visible failure now —
        // it used to fall back to a fabricated offline profile that looked
        // signed in but could not actually reach any authenticated route.
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.detail
            : "Serverul RO-INTEL nu răspunde. Reîncercați în câteva momente.";
        setUser(null);
        setNeedsOnboarding(false);
        setAuthError(message);
      }
    }

    supabase.auth
      .getSession()
      .then(({ data }) => adoptSession(data.session))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      adoptSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Repairs desks saved (or migrated on read, above) before this user's
  // real tenant was known, or that were pointed at a different tenant
  // entirely — the backend now 403s any desk whose tenant_id doesn't
  // match the signed-in user's own scripts/provision_tenant.py row, so a
  // stale desk would otherwise produce a permanently broken dashboard
  // with no obvious fix. Runs whenever the confirmed tenant changes
  // (login, or switching accounts), not just once on mount.
  useEffect(() => {
    if (!user?.tenant_id) return;
    setDesks((prev) => {
      if (prev.every((d) => d.tenant_id === user.tenant_id)) return prev;
      const repaired = prev.map((d) => ({ ...d, tenant_id: user.tenant_id }));
      if (typeof window !== "undefined") {
        localStorage.setItem("ro_intel_user_desks", JSON.stringify(repaired));
      }
      return repaired;
    });
  }, [user?.tenant_id]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "" },
    });
  };

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "" },
    });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthError(null);
    setNeedsOnboarding(false);
  };

  const completeOnboarding = async (profile: OnboardingProfile): Promise<{ error: string | null }> => {
    try {
      await apiCompleteOnboarding(profile);
    } catch (err) {
      return { error: err instanceof ApiError ? err.detail : "Configurarea contului a eșuat. Reîncercați." };
    }
    // The onboarding call only creates the tenant — it doesn't return a
    // session-shaped object, so re-running the same sync the initial
    // effect uses is what actually picks up the now-confirmed tenant_id
    // and flips needsOnboarding off.
    const { data } = await supabase.auth.getSession();
    const authUser = data.session?.user;
    if (!authUser) return { error: null };
    try {
      const synced = await syncBackendAuth(
        authUser.email || "",
        authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split("@")[0],
        authUser.user_metadata?.avatar_url
      );
      if (synced?.user?.tenant_id) {
        setNeedsOnboarding(false);
        setUser({ ...synced.user, tenant_id: synced.user.tenant_id, is_subscribed: true });
        setAuthError(null);

        // Without this, a brand-new individual's first desk is whichever
        // generic DEFAULT_DESKS entry happens to be active — not what they
        // just told the onboarding form. The backend tenant already has
        // the real criteria (that's what actually drives matching); this
        // just makes the desk UI (target counties, keywords, budget shown
        // on /newsletter etc.) reflect the same thing instead of a
        // leftover example profile.
        const newDesk: BusinessDesk = {
          id: "desk_" + Date.now(),
          name: profile.display_name?.trim() || synced.user.full_name || "Profilul meu",
          primary_domain: profile.domain,
          target_counties: profile.target_counties,
          min_budget_ron: profile.min_value_ron,
          keywords: profile.keywords,
          divisions: [],
          tenant_id: synced.user.tenant_id,
        };
        saveDesksToStorage([newDesk]);
        switchDesk(newDesk.id);
      }
    } catch {
      // The account was created successfully even if this re-sync hiccups;
      // the next page load's own sync will pick it up.
    }
    return { error: null };
  };

  const activeDesk = desks.find((d) => d.id === activeDeskId) || desks[0] || DEFAULT_DESKS[0];

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        needsOnboarding,
        completeOnboarding,
        preferences,
        updatePreferences,
        desks,
        activeDesk,
        activeTenantId: activeDesk.tenant_id || DEFAULT_TENANT_ID,
        createDesk,
        updateDesk,
        deleteDesk,
        switchDesk,
        signInWithGoogle,
        signInWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
