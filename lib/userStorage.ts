/**
 * Browser storage that belongs to one account.
 *
 * Every key that holds a person's data (company identity, drafts, the
 * copilot thread, a handed-over clause list) is namespaced by the signed-in
 * user's id, and all of them are removed on sign-out. Two people sharing a
 * computer used to see each other's company profile and drafts — and the
 * second person's empty account was even filled with the first one's
 * company identity on sign-in.
 *
 * Device settings (theme, the install-prompt dismissal) are not user data
 * and stay.
 */

/** Prefixes of every key that is per-person, in either storage. */
const USER_DATA_PREFIXES = [
  "ro_intel_company_profile",
  "ro_intel_drafting_autosave:",
  "ro_intel_copilot_thread",
  "ro_intel_handoff:",
  // Retired stores, cleared on sight: they were never per-user.
  "ro_intel_drafting_bidder",
  "ro_intel_user_prefs",
  "ro_intel_user_desks",
  "ro_intel_active_desk_id",
];

/** `base:userId`, or `base:anon` before sign-in. */
export function userKey(base: string, userId?: string | null): string {
  return `${base}:${userId || "anon"}`;
}

function sweep(storage: Storage | undefined) {
  if (!storage) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && USER_DATA_PREFIXES.some((p) => key.startsWith(p))) doomed.push(key);
    }
    doomed.forEach((k) => storage.removeItem(k));
  } catch {
    // Blocked storage: nothing to clear.
  }
}

/** Removes every per-person key from this browser. Called on sign-out. */
export function clearUserStorage() {
  if (typeof window === "undefined") return;
  sweep(window.localStorage);
  sweep(window.sessionStorage);
}

/** Retired, never-per-user keys: dropped at start-up whoever is signed in. */
export function dropRetiredKeys() {
  if (typeof window === "undefined") return;
  for (const key of ["ro_intel_drafting_bidder", "ro_intel_user_prefs", "ro_intel_user_desks", "ro_intel_active_desk_id", "ro_intel_company_profile"]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* blocked storage */
    }
  }
}
