"use client";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { translateAuthError } from "@/lib/authErrors";
import { callbackUrl, safeNext } from "@/lib/authRedirect";
import { clearUserStorage, dropRetiredKeys } from "@/lib/userStorage";
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
  /** `next`: the same-site path to land on after the sign-in completes. */
  signInWithGoogle: (next?: string | null) => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, next?: string | null) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    next?: string | null
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  authError: null,
  needsOnboarding: false,
  completeOnboarding: async () => ({ error: null }),
  updateProfile: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signInWithEmail: async () => ({ error: null }),
  signUpWithPassword: async () => ({ error: null, needsEmailConfirmation: false }),
  signInWithPassword: async () => ({ error: null }),
  requestPasswordReset: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Alert settings are not kept in the browser any more: the server
  // profile is the only copy (GET /api/v1/me/preferences). The old local
  // store and the never-per-user keys are removed here.
  useEffect(() => {
    dropRetiredKeys();
  }, []);

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      // A sign-out from another tab or an ended session clears this
      // person's browser data as well, not only the button in this tab.
      if (event === "SIGNED_OUT") clearUserStorage();
      adoptSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [adoptSynced]);

  const signInWithGoogle = async (next?: string | null) => {
    // Returns { error } like every other method here. It used to discard
    // it entirely, so if the Google provider was disabled, the redirect
    // blocked, or the network down, the most prominent button on the login
    // screen produced no error, no spinner and no navigation — a complete
    // dead end with nothing to act on.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(safeNext(next)) },
    });
    return { error: translateAuthError(error?.message) };
  };

  const signInWithEmail = async (email: string, next?: string | null) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(safeNext(next)) },
    });
    return { error: translateAuthError(error?.message) };
  };

  const signUpWithPassword = async (email: string, password: string, next?: string | null) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callbackUrl(safeNext(next)) },
    });
    if (error) return { error: translateAuthError(error.message), needsEmailConfirmation: false };
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
    return { error: translateAuthError(error?.message) };
  };

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/reset-password` : "",
    });
    return { error: translateAuthError(error?.message) };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Everything this person left in the browser goes with them: company
    // identity, drafts, the copilot thread, handed-over clauses.
    clearUserStorage();
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
