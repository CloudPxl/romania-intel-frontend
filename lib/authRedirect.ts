/**
 * Where to land after signing in.
 *
 * A signed-out visitor who opens a deep link — the "Deschide dosarul
 * complet" button in an alert email, a /drafting?source_id=… link — goes
 * through AuthGate → /login → (magic link or Google) → /auth/callback, and
 * used to end on "/" with the dossier lost. The path travels as `?next=` on
 * each hop and, as a backup for the hops that cannot carry it (an OAuth
 * provider, a magic link opened in the same browser), in sessionStorage.
 *
 * Only same-site paths are accepted: "/…" but never "//host" or a scheme,
 * so `next` cannot be turned into an open redirect.
 */

const NEXT_KEY = "ro_intel_next";

export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  let path = value.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return null;
  if (/[\r\n]/.test(path)) return null;
  // Never bounce back into the auth pages themselves.
  if (path.startsWith("/login") || path.startsWith("/auth/")) return null;
  return path;
}

/** The current page as a `next` value. */
export function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

export function rememberNext(path: string | null | undefined) {
  const safe = safeNext(path);
  if (!safe || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(NEXT_KEY, safe);
  } catch {
    /* blocked storage: the URL still carries it */
  }
}

/** Reads (and forgets) the destination: the URL's `next` first, then the backup. */
export function consumeNext(fromUrl?: string | null): string {
  let stored: string | null = null;
  if (typeof window !== "undefined") {
    try {
      stored = window.sessionStorage.getItem(NEXT_KEY);
      window.sessionStorage.removeItem(NEXT_KEY);
    } catch {
      stored = null;
    }
  }
  return safeNext(fromUrl) || safeNext(stored) || "/";
}

/** `/login?next=…` for the given path. */
export function loginHref(path?: string): string {
  const safe = safeNext(path ?? currentPath());
  return safe && safe !== "/" ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}

/** The callback URL a sign-in flow should return to, carrying `next`. */
export function callbackUrl(next?: string | null): string {
  if (typeof window === "undefined") return "";
  const safe = safeNext(next);
  const base = `${window.location.origin}/auth/callback`;
  return safe && safe !== "/" ? `${base}?next=${encodeURIComponent(safe)}` : base;
}
