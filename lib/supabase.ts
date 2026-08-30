import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://upzyczsfizenlogkfvsa.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseAnonKey && typeof window !== "undefined") {
  // Without the anon key no session can ever be issued, so every backend
  // call would 401 with no obvious cause. Fail loudly in the console
  // rather than presenting a login screen that silently cannot work.
  console.error(
    "[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set — autentificarea nu va funcționa."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE keeps the code verifier in this browser, which is why the OAuth
    // callback must be completed client-side (see app/auth/callback/page.tsx).
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
