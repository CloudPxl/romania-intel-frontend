"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { syncBackendAuth, switchTenantWorkspace } from "@/lib/api";

export interface BusinessDivision {
  id: string;
  name: string;
  keywords: string[];
}

export interface BusinessDesk {
  id: string;
  name: string;
  cui: string;
  primary_domain: string;
  target_counties: string[];
  min_budget_ron: number;
  keywords: string[];
  divisions: BusinessDivision[];
}

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
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  preferences: UserPreferences;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => void;
  desks: BusinessDesk[];
  activeDesk: BusinessDesk;
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
    name: "SC Infra Construct Transilvania SRL",
    cui: "RO12345678",
    primary_domain: "infrastructura",
    target_counties: ["Cluj", "Iasi", "Bihor", "Timis", "Bucuresti", "Brasov", "Constanta"],
    min_budget_ron: 5000000,
    keywords: ["drum", "pod", "pasaj", "asfalt", "its", "scats", "semaforizare", "metrou"],
    divisions: [
      { id: "div_heavy", name: "Infrastructura Grea si Drumuri", keywords: ["drum", "pod", "asfalt", "metrou"] },
      { id: "div_its", name: "Smart City si Sisteme ITS", keywords: ["its", "scats", "semaforizare", "anpr"] }
    ]
  },
  {
    id: "desk_medtech",
    name: "SC MedTech Pharma SRL",
    cui: "RO98765432",
    primary_domain: "sanatate",
    target_counties: ["Bucuresti", "Iasi", "Cluj", "Timis", "Brasov"],
    min_budget_ron: 3000000,
    keywords: ["rmn", "ct", "accelerator", "radioterapie", "spital", "oncologie", "pacs"],
    divisions: [
      { id: "div_imagistica", name: "Imagistica Medicala si RMN", keywords: ["rmn", "ct", "radioterapie"] },
      { id: "div_digital_health", name: "Digitalizare Spitale PACS", keywords: ["pacs", "soft medical"] }
    ]
  }
];

const DEFAULT_PREFERENCES: UserPreferences = {
  notification_email: "",
  auto_alert_score: 9.0,
  default_sort: "score_desc"
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: () => {},
  desks: DEFAULT_DESKS,
  activeDesk: DEFAULT_DESKS[0],
  createDesk: () => {},
  updateDesk: () => {},
  deleteDesk: () => {},
  switchDesk: () => {},
  signInWithGoogle: async () => {},
  signInWithEmail: async () => ({ error: null }),
  signOut: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [desks, setDesks] = useState<BusinessDesk[]>(DEFAULT_DESKS);
  const [activeDeskId, setActiveDeskId] = useState<string>(DEFAULT_DESKS[0].id);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDesks = localStorage.getItem("ro_intel_user_desks");
      const savedActiveId = localStorage.getItem("ro_intel_active_desk_id");
      const savedPrefs = localStorage.getItem("ro_intel_user_prefs");

      if (savedDesks) {
        try {
          const parsed = JSON.parse(savedDesks);
          if (parsed && parsed.length > 0) setDesks(parsed);
        } catch {}
      }
      if (savedActiveId) setActiveDeskId(savedActiveId);
      if (savedPrefs) {
        try { setPreferences(JSON.parse(savedPrefs)); } catch {}
      }
    }
  }, []);

  const saveDesksToStorage = (updatedDesks: BusinessDesk[]) => {
    setDesks(updatedDesks);
    if (typeof window !== "undefined") {
      localStorage.setItem("ro_intel_user_desks", JSON.stringify(updatedDesks));
    }
  };

  const createDesk = (deskData: Omit<BusinessDesk, "id">) => {
    const newDesk: BusinessDesk = {
      ...deskData,
      id: "desk_" + Date.now()
    };
    const updated = [...desks, newDesk];
    saveDesksToStorage(updated);
    switchDesk(newDesk.id);
  };

  const updateDesk = (id: string, deskData: Partial<BusinessDesk>) => {
    const updated = desks.map(d => (d.id === id ? { ...d, ...deskData } : d));
    saveDesksToStorage(updated);
  };

  const deleteDesk = (id: string) => {
    if (desks.length <= 1) {
      alert("Trebuie sa pastrati cel putin un Desk activ.");
      return;
    }
    const updated = desks.filter(d => d.id !== id);
    saveDesksToStorage(updated);
    if (activeDeskId === id) {
      switchDesk(updated[0].id);
    }
  };

  const switchDesk = (id: string) => {
    setActiveDeskId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("ro_intel_active_desk_id", id);
    }
    switchTenantWorkspace(id);
  };

  const updatePreferences = (newPrefs: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPrefs };
      if (typeof window !== "undefined") {
        localStorage.setItem("ro_intel_user_prefs", JSON.stringify(updated));
      }
      return updated;
    });
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
        redirectTo: typeof window !== "undefined" ? window.location.origin : ""
      }
    });
  };

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : ""
      }
    });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const activeDesk = desks.find(d => d.id === activeDeskId) || desks[0] || DEFAULT_DESKS[0];

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        preferences,
        updatePreferences,
        desks,
        activeDesk,
        createDesk,
        updateDesk,
        deleteDesk,
        switchDesk,
        signInWithGoogle,
        signInWithEmail,
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
