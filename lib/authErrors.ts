/**
 * Romanian messages for Supabase Auth failures.
 *
 * `lib/api.ts` already does this carefully for the backend (decodeError),
 * but the Supabase path had nothing — so the three most common failures on
 * the login screen read "Invalid login credentials", "Email not confirmed"
 * and "For security purposes, you can only request this after 60 seconds"
 * in an otherwise fully Romanian UI.
 *
 * Matched on a lowercased substring rather than a code, because supabase-js
 * does not expose a stable machine-readable code for all of these. Anything
 * unmatched falls through to the original text: an untranslated real message
 * is still far better than a generic one that hides what went wrong.
 */
const TRANSLATIONS: [RegExp, string][] = [
  [/invalid login credentials/i, "Email sau parolă incorectă."],
  [/email not confirmed/i, "Adresa de email nu a fost confirmată. Verificați-vă inboxul."],
  [/user already registered|already been registered/i, "Există deja un cont cu această adresă. Autentificați-vă."],
  [
    /for security purposes.*?(\d+)\s*seconds?/i,
    "Prea multe încercări. Reîncercați peste un minut.",
  ],
  [/email rate limit exceeded|over_email_send_rate_limit/i, "S-au trimis prea multe emailuri. Reîncercați mai târziu."],
  [/password should be at least (\d+)/i, "Parola este prea scurtă — folosiți cel puțin 6 caractere."],
  [/weak password/i, "Parola este prea slabă. Folosiți litere, cifre și minimum 8 caractere."],
  [/unable to validate email address|invalid email/i, "Adresa de email nu este validă."],
  [/token has expired|otp_expired|invalid or has expired/i, "Linkul a expirat. Solicitați unul nou."],
  [/user not found/i, "Nu există un cont pentru această adresă."],
  [/same as the old password/i, "Noua parolă trebuie să fie diferită de cea veche."],
  [/provider is not enabled|unsupported provider/i, "Autentificarea cu Google nu este activată. Folosiți emailul."],
  [/network|fetch failed|failed to fetch/i, "Conexiunea a eșuat. Verificați internetul și reîncercați."],
];

export function translateAuthError(message?: string | null): string | null {
  if (!message) return null;
  for (const [pattern, romanian] of TRANSLATIONS) {
    if (pattern.test(message)) return romanian;
  }
  return message;
}
