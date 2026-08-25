"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { syncBackendAuth, switchTenantWorkspace } from "@/lib/api";

export interface UserProfile {
  email: string;
  full_name: string;
  tenant_id: string;
  role: string;
  avatar_url?: string;
  is_subscribed?: boolean;
}

export interface UserPreferences {
  notification_email?: string;
  auto_alert_score: number;
  default_sort: "score_desc" | "budget_desc" | "date_desc" | "deadline_asc";
  view_mode: "cards" | "compact";
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  preferences: UserPreferences;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => void;
  activeTenant: string;
  setActiveTenant: (tenantId: string) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  notification_email: "",
  auto_alert_score: 9.0,
  default_sort: "score_desc",
  view_mode: "cards"
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: () => {},
  activeTenant: "t1_infra_transilvania",
  setActiveTenant: () => {},
  signInWithGoogle: async () => {},
  signInWithEmail: async () => ({ error: null }),
  signOut: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTenant, setActiveTenantState] = useState("t1_infra_transilvania");
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPrefs = localStorage.getItem("ro_intel_user_prefs");
      if (savedPrefs) {
        try { setPreferences(JSON.parse(savedPrefs)); } catch {}
      }
    }
  }, []);

  const updatePreferences = (newPrefs: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPrefs };
      if (typeof window !== "undefined") {
        localStorage.setItem("ro_intel_user_prefs", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const setActiveTenant = (tenantId: string) => {
    setActiveTenantState(tenantId);
    switchTenantWorkspace(tenantId);
  };

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const authUser = session.user;
          const synced = await syncBackendAuth(
            authUser.email || "user@ro-intel.xyz",
            authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split("@")[0],
            authUser.user_metadata?.avatar_url
          );
          if (synced?.user) {
            setUser({ ...synced.user, is_subscribed: true });
            setActiveTenantState(synced.user.tenant_id || "t1_infra_transilvania");
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn("[AuthInit] Session verify note:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const authUser = session.user;
        const synced = await syncBackendAuth(
          authUser.email || "user@ro-intel.xyz",
          authUser.user_metadata?.full_name || authUser.user_metadata?.name,
          authUser.user_metadata?.avatar_url
        );
        if (synced?.user) {
          setUser({ ...synced.user, is_subscribed: true });
          setActiveTenantState(synced.user.tenant_id || "t1_infra_transilvania");
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}`
      }
    });
  };

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}`
      }
    });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, preferences, updatePreferences, activeTenant, setActiveTenant, signInWithGoogle, signInWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
