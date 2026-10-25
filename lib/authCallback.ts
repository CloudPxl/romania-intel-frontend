import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { translateAuthError } from "@/lib/authErrors";

/**
 * Turns the URL of an auth landing page (/auth/callback, /auth/reset-password)
 * into a session. Three shapes reach it:
 *
 * 1. `?token_hash=…&type=…` — the email templates' link. Verified with
 *    verifyOtp, which needs nothing stored in the browser, so a magic link
 *    works when opened on another device, in another browser or inside an
 *    email app's webview. (The Supabase email templates must link here with
 *    `{{ .TokenHash }}`; see CLAUDE.md.)
 * 2. `?code=…` — PKCE (Google OAuth, and links from the default templates).
 *    The verifier lives in the localStorage of the browser that STARTED the
 *    sign-in. The client exchanges it by itself on load
 *    (detectSessionInUrl), so the session is checked first and the code is
 *    exchanged here only if that did not happen.
 * 3. An error from the provider (`?error_description=…`).
 *
 * Single-flight: React Strict Mode mounts effects twice in development and
 * both pages can run while the client is still consuming the URL; a second
 * exchange of a code that has already been used is exactly what produced
 * the misleading "PKCE code verifier not found" — so concurrent callers
 * share one attempt.
 */

export type AuthLandingResult = { ok: true } | { ok: false; error: string };

const OTP_TYPES: EmailOtpType[] = ["magiclink", "signup", "recovery", "invite", "email_change", "email"];
let inFlight: { href: string; promise: Promise<AuthLandingResult> } | null = null;

const CROSS_DEVICE =
  "Linkul a fost deschis în alt browser sau pe alt dispozitiv decât cel în care l-ați cerut. " +
  "Cereți un link nou din browserul în care îl veți deschide — sau autentificați-vă cu Google.";

async function attempt(href: string): Promise<AuthLandingResult> {
  const url = new URL(href);
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError) return { ok: false, error: translateAuthError(providerError) || providerError };

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return { ok: true };
    // A link opened twice: the first open already signed this browser in.
    const { data } = await supabase.auth.getSession();
    if (data.session) return { ok: true };
    return { ok: false, error: translateAuthError(error.message) || "Linkul a expirat sau a fost deja folosit. Cereți unul nou." };
  }

  // The client may already have exchanged ?code= on load.
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return { ok: true };

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return { ok: true };
    const { data: after } = await supabase.auth.getSession();
    if (after.session) return { ok: true };
    if (/code verifier/i.test(error.message)) return { ok: false, error: CROSS_DEVICE };
    return { ok: false, error: translateAuthError(error.message) || error.message };
  }

  return { ok: false, error: "Linkul de autentificare este incomplet sau a expirat." };
}

export function completeAuthFromUrl(href: string): Promise<AuthLandingResult> {
  if (inFlight && inFlight.href === href) return inFlight.promise;
  const promise = attempt(href).catch((e: unknown) => ({
    ok: false as const,
    error: e instanceof Error ? e.message : "Autentificarea nu a putut fi finalizată.",
  }));
  inFlight = { href, promise };
  return promise;
}
