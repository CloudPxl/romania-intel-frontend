"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { syncBackendAuth, switchTenantWorkspace } from "@/lib/api";

interface UserProfile {
  email: string;
  full_name: string;
  tenant_id: string;
  role: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  activeTenant: string;
  setActiveTenant: (tenantId: string) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  activeTenant: "t1_infra_transilvania",
  setActiveTenant: () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTenant, setActiveTenantState] = useState("t1_infra_transilvania");

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
            setUser(synced.user);
            setActiveTenantState(synced.user.tenant_id || "t1_infra_transilvania");
          }
        } else {
          // Default authenticated session for instant access
          setUser({
            email: "director@infraconstruct.ro",
            full_name: "Director Bidding",
            tenant_id: "t1_infra_transilvania",
            role: "Director Strategie & Bidding"
          });
        }
      } catch (err) {
        console.warn("[AuthInit] fallback session:", err);
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
          setUser(synced.user);
          setActiveTenantState(synced.user.tenant_id || "t1_infra_transilvania");
        }
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
        redirectTo: `${window.location.origin}`
      }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, activeTenant, setActiveTenant, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
