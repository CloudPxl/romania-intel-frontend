"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  syncBackendAuth,
  completeOnboarding as apiCompleteOnboarding,
  updateMyProfile as apiUpdateMyProfile,
  ApiError,
  type OnboardingProfile,
  type UserProfile,
} from "@/lib/api";

/**
 * Session + the signed-in user's own profile.
 *
 * This used to carry a browser-local "desk" abstraction — a list of saved
 * company profiles, each stamped with the backend tenant id to send with
 * every request. All of it existed to answer one question ("which tenant
 * am I?") that no longer has more than one possible answer: the backend
 * takes the user from the verified JWT and there is no other account to
 * address. Desks, the tenant lookup table, the domain→tenant mapping and
 * the three separate repair mechanisms that kept them pointing at a valid
 * tenant are all gone with it.
 */

export interface SessionUser {
  user_id?: string;
  email: string;
  full_name: string;
  avatar_url?: string;
}

export interface UserPreferences {
  notification_email?: string;
  /**
   * Mirrored locally only so the Settings field can be repopulated on
   * reopen — the authoritative copy is on the profile in Postgres, which
   * is what the alert dispatcher actually reads.
   */
  telegram_chat_id?: string;
  auto_alert_score: number;
  default_sort: "score_desc" | "budget_desc" | "date_desc" | "deadline_asc";
}

interface AuthContextType {
  user: SessionUser | null;
  /** The user's own matching criteria and alert settings. */
  profile: UserProfile | null;
  loading: boolean;
  /** Set when the backend rejected the session — surfaced in the UI. */
  authError: string | null;
  /**
   * Session is valid but this account hasn't set up its criteria yet.
   * Deliberately distinct from authError: this is not a failure, it's the
   * one-time setup step AuthGate shows instead of a dead end.
   */
  needsOnboarding: boolean;
  completeOnboarding: (profile: OnboardingProfile) => Promise<{ error: string | null }>;
  updateProfile: (profile: OnboardingProfile) => Promise<{ error: string | null }>;
  preferences: UserPreferences;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  notification_email: "",
  auto_alert_score: 9.0,
  default_sort: "score_desc",
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  authError: null,
  needsOnboarding: false,
  completeOnboarding: async () => ({ error: null }),
  updateProfile: async () => ({ error: null }),
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: () => {},
  signInWithGoogle: async () => {},
  signInWithEmail: async () => ({ error: null }),
  signUpWithPassword: async () => ({ error: null, needsEmailConfirmation: false }),
  signInWithPassword: async () => ({ error: null }),
  requestPasswordReset: async () => ({ error: null }),
  signOut: async () => {},
});

/**
 * Keys written by the deleted desk system. Nothing reads them any more, so
 * without this every returning user carries dead JSON in their browser
 * forever — one of them holds a tenant id that no longer means anything.
 */
const RETIRED_STORAGE_KEYS = ["ro_intel_user_desks", "ro_intel_active_desk_id"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      RETIRED_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      const savedPrefs = localStorage.getItem("ro_intel_user_prefs");
      if (savedPrefs) setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(savedPrefs) });
    } catch {
      /* corrupt localStorage — fall back to defaults rather than crashing */
    }
  }, []);

  const updatePreferences = (newPrefs: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };
      if (typeof window !== "undefined") {
        localStorage.setItem("ro_intel_user_prefs", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const adoptSynced = useCallback(
    (synced: { user: { user_id?: string; email: string; full_name: string; onboarded: boolean; avatar_url?: string }; profile: UserProfile | null }) => {
      if (!synced.user.onboarded) {
        // Signed in successfully, but hasn't chosen what to watch yet.
        // Not a rejected session — there is no admin to contact in a
        // self-serve product — so the setup form is shown instead.
        //
        // `user` STAYS SET here. It used to be nulled, which made
        // "signed in but not yet configured" indistinguishable from
        // "signed out" to every consumer that tests `user` — and that
        // one line caused the whole broken-login experience: /login's
        // `if (user) redirect` never fired, so a correct email+password
        // (or Google) sign-in silently left you sitting on the login
        // screen, and clicking Autentificare again just repeated it;
        // meanwhile app/page.tsx's `user && needsOnboarding` branch
        // could never be true, so a new Google account landed on the
        // public marketing page and was never asked the setup
        // questions at all. `user` means "there is a verified
        // session"; `needsOnboarding` is orthogonal to it.
        setUser(synced.user);
        setProfile(null);
        setAuthError(null);
        setNeedsOnboarding(true);
        return;
      }
      setNeedsOnboarding(false);
      setUser(synced.user);
      setProfile(synced.profile);
      setAuthError(null);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function adoptSession(session: { user: { email?: string; user_metadata?: Record<string, string> } } | null) {
      if (!session?.user) {
        if (!cancelled) {
          setUser(null);
          setProfile(null);
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
        adoptSynced(synced);
      } catch (err) {
        // The backend rejecting a session is a real, visible failure — it
        // used to fall back to a fabricated offline profile that looked
        // signed in but could not reach any authenticated route.
        if (cancelled) return;
        setUser(null);
        setProfile(null);
        setNeedsOnboarding(false);
        setAuthError(
          err instanceof ApiError ? err.detail : "Serverul RO-INTEL nu răspunde. Reîncercați în câteva momente."
        );
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
  }, [adoptSynced]);

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

  const signUpWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "" },
    });
    if (error) return { error: error.message, needsEmailConfirmation: false };
    // Supabase returns 200 with no error for a duplicate email too — it
    // deliberately doesn't reveal whether an account already exists, to
    // avoid leaking which addresses are registered. The one visible tell
    // is an empty `identities` array on the returned (unconfirmed, unusable)
    // user. Without checking this, a returning user typing their own email
    // sees "check your inbox" for a confirmation email that never arrives.
    if (data.user && data.user.identities?.length === 0) {
      return {
        error: "Există deja un cont cu acest email. Încercați să vă autentificați sau folosiți linkul magic.",
        needsEmailConfirmation: false,
      };
    }
    // A session is returned immediately only when the Supabase project has
    // email confirmation turned off; otherwise data.session is null until
    // the confirmation link is followed.
    return { error: null, needsEmailConfirmation: !data.session };
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/reset-password` : "",
    });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setAuthError(null);
    setNeedsOnboarding(false);
  };

  const completeOnboarding = async (submitted: OnboardingProfile): Promise<{ error: string | null }> => {
    try {
      const { profile: created } = await apiCompleteOnboarding(submitted);
      // The response already carries the configured profile, so there is
      // no second round trip and no window where the UI knows the account
      // exists but not what is in it.
      setProfile(created);
      setNeedsOnboarding(false);
      const { data } = await supabase.auth.getSession();
      const authUser = data.session?.user;
      setUser({
        user_id: created.id,
        email: created.email,
        full_name: created.display_name || created.email.split("@")[0],
        avatar_url: authUser?.user_metadata?.avatar_url,
      });
      return { error: null };
    } catch (err) {
      return { error: err instanceof ApiError ? err.detail : "Configurarea contului a eșuat. Reîncercați." };
    }
  };

  const updateProfile = async (submitted: OnboardingProfile): Promise<{ error: string | null }> => {
    try {
      const { profile: updated } = await apiUpdateMyProfile(submitted);
      setProfile(updated);
      return { error: null };
    } catch (err) {
      return { error: err instanceof ApiError ? err.detail : "Salvarea profilului a eșuat. Reîncercați." };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        needsOnboarding,
        completeOnboarding,
        updateProfile,
        preferences,
        updatePreferences,
        signInWithGoogle,
        signInWithEmail,
        signUpWithPassword,
        signInWithPassword,
        requestPasswordReset,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
