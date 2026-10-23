/**
 * Links between the workspace's tools, carrying the tender instead of asking
 * the user to re-type it. Every tool reads `source_id` and fetches the full
 * record itself, so the URL stays short and the data stays authoritative.
 */

export type DraftingTab = "propunere" | "clarificari";
export type LetterType = "clarification" | "evaluation_response" | "abnormally_low_price" | "dossier_access" | "foia";
export type AnalyticsTool = "copilot" | "competitor" | "caiet" | "win";

export function draftingHref(sourceId: string | null | undefined, tab: DraftingTab = "propunere", extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ tab, ...extra });
  if (sourceId) params.set("source_id", sourceId);
  return `/drafting?${params.toString()}`;
}

export function analyticsHref(sourceId: string | null | undefined, tool: AnalyticsTool, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ tool, ...extra });
  if (sourceId) params.set("source_id", sourceId);
  return `/analytics?${params.toString()}`;
}

/** Clauses forwarded from the caiet scanner into a clarification request.
 *  Kept in sessionStorage, not the URL: a dozen quoted clauses with their
 *  legal grounds would make a link no browser should have to carry. */
const HANDOFF_PREFIX = "ro_intel_handoff:";

export interface ClauseHandoff {
  project_title?: string;
  points: string[];
  citations: string[];
  created_at: string;
}

export function stashClauses(sourceId: string | null | undefined, handoff: Omit<ClauseHandoff, "created_at">): string {
  const key = sourceId || "nou";
  try {
    sessionStorage.setItem(HANDOFF_PREFIX + key, JSON.stringify({ ...handoff, created_at: new Date().toISOString() }));
  } catch {
    // Storage blocked: the user lands on the form and pastes instead.
  }
  return key;
}

/** Read once: a refresh should not paste the same clauses twice. */
export function takeClauses(key: string | null | undefined): ClauseHandoff | null {
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(HANDOFF_PREFIX + key);
    if (!raw) return null;
    sessionStorage.removeItem(HANDOFF_PREFIX + key);
    return JSON.parse(raw) as ClauseHandoff;
  } catch {
    return null;
  }
}
