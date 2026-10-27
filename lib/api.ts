import { supabase } from "@/lib/supabase";

/**
 * The single HTTP boundary to the RO-INTEL backend.
 *
 * Every function here maps 1:1 to a FastAPI route in the engine's api.py
 * or routers/*.py. Components must not call fetch() directly — the auth
 * header, base-URL selection and error decoding all live in apiFetch()
 * below, and bypassing it means bypassing all three.
 */

function getApiBase(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "http://localhost:8000";
    return "https://api.ro-intel.xyz";
  }
  return process.env.NEXT_PUBLIC_API_BASE || "https://api.ro-intel.xyz";
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
  /** 401/403: the caller needs to sign in (or sign in again). */
  get isAuthError() {
    return this.status === 401 || this.status === 403;
  }
}

/**
 * Reads the live Supabase access token for the current session.
 *
 * supabase-js refreshes an expiring token inside getSession(), so this is
 * read per request rather than cached — a token cached at page load would
 * go stale after an hour and start 401-ing against the backend's real JWT
 * verification (security.py raises on an expired signature).
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function decodeError(res: Response): Promise<string> {
  // FastAPI puts the human-readable message in `detail` — including the
  // Romanian ones raised by SecurityGuard and the workflow engine. Surface
  // that instead of a generic "request failed", so a user who needs to log
  // in again is actually told so.
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 401) return "Sesiune expirată. Reautentificați-vă.";
  if (res.status === 429) return "Prea multe cereri. Reîncercați în câteva momente.";
  if (res.status >= 500) return "Serverul nu a putut procesa cererea. Reîncercați.";
  return `Cererea a eșuat (${res.status}).`;
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Send the request without an Authorization header (public routes). */
  anonymous?: boolean;
  /** Return the raw Response instead of parsed JSON (file downloads). */
  raw?: boolean;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, anonymous, raw, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);

  if (!anonymous) {
    const token = await getAccessToken();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    // Never set Content-Type for FormData — the browser has to add its own
    // multipart boundary, and setting it manually breaks the upload.
    payload = body;
  } else if (body !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${getApiBase()}${path}`, { ...rest, headers: finalHeaders, body: payload });

  if (!res.ok) throw new ApiError(res.status, await decodeError(res));
  if (raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    // The backend's list filters (counties, categories) are declared as
    // repeated query params, not comma-joined strings.
    if (Array.isArray(value)) value.forEach((v) => v && search.append(key, String(v)));
    else search.append(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

/* ---------------------------------------------------------------- types */

/** What the dossier shows for a pre-SEAP signal instead of price and remedy
 *  figures (record_kind.py:pre_seap_mode). */
export interface PreSeapMode {
  signal_type: string | null;
  signal_label: string;
  issuing_authority: string | null;
  beneficiary_authority: string | null;
  investment_stage: string | null;
  next_step: string;
  /** Legea 544/2001 presets for Redactare's "Informații publice" letter. */
  foia_presets: string[];
  not_applicable: string;
}

export type RecordKind = "ACTIVE_TENDER" | "PRE_TENDER_SIGNAL";

export interface Lead {
  source_id: string;
  /**
   * ACTIVE_TENDER: a procurement procedure. PRE_TENDER_SIGNAL: a building
   * permit, an environmental agreement, a council decision, a budget or a
   * programme — no procedure yet, so no 80% threshold, cauțiune or
   * guarantees. Set by the backend on every lead.
   */
  record_kind?: RecordKind;
  is_procurement_procedure?: boolean;
  pre_seap?: PreSeapMode;
  source_type?: string;
  source_url?: string;
  project_title: string;
  entity_name?: string;
  county?: string;
  locality?: string;
  category?: string;
  sub_category?: string;
  financial_value_ron?: number;
  funding_source?: string;
  /** From GET /me/opportunities/{id} only: what the tender's funding adds
   *  to the offer file (art. 5k always; beneficial owner + DNSH for PNRR;
   *  DNSH for other EU funds). Redactare pre-selects these. */
  suggested_declarations?: DeclarationId[];
  published_date?: string;
  action_deadline?: string;
  opportunity_score?: number;
  executive_summary?: string;
  sales_pitch_angle?: string;
  cpv_code?: string;
  /**
   * Contracting authority's fiscal code (CUI), stored bare — the "RO" VAT
   * prefix is stripped on write, so display it with the prefix only if you
   * add one yourself. Present on SEAP-sourced leads (DA/CAN/CN/SC); null
   * for scrapers whose source doesn't publish it.
   */
  authority_cui?: string | null;
  /**
   * The award procedure, from SEAP's own sysProcedureType — not inferred.
   * See PROCEDURE_TYPE_LABELS for the display names.
   */
  procedure_type?: string | null;
  /**
   * Stated evaluation method (e.g. "Pretul cel mai scazut"). Null on every
   * lead today: the backend column and plumbing exist, but no live scraper
   * has found e-licitatie.ro's per-notice endpoint for it yet — so treat a
   * missing value as "not published to us", not as "no criterion".
   */
  award_criterion?: string | null;
  /**
   * Why this lead is where it is in the feed. Null when the user hasn't
   * onboarded yet (nothing to rank against). Computed by the ranking
   * query, not recomputed client-side.
   */
  match?: {
    /** Internal ORDER BY weight, NOT a 0-10 score despite the name — can
     *  run well past 10 (keyword/county/domain/value weights of
     *  50/20/15/10 plus opportunity_score on top). Never render this to a
     *  user; use match_strength for that. */
    score: number;
    /** The real 0-10-bounded "how well does this fit your profile" number
     *  — this is what "Scor potrivire" shows. */
    match_strength: number;
    is_match: boolean;
    excluded: boolean;
    reasons: string[];
  } | null;
  /**
   * Present only on TED-sourced leads that got far enough to attempt a
   * cross-reference against SEAP. See ted_scraper.py's
   * find_seap_cross_reference — this is a best-effort heuristic (at least
   * 2 of 3 independent signals must agree), never a verified identity, so
   * it's surfaced for confirmation rather than treated as a real join.
   */
  metadata?: {
    seap_cross_reference?: {
      matched_source_id: string;
      matched_entity_name: string;
      basis: ("cpv_prefix" | "value_within_tolerance" | "buyer_name")[];
    } | null;
    [key: string]: unknown;
  };
}

export interface FeedResponse {
  count: number;
  leads: Lead[];
  data_source: "postgres" | "file-cache";
  data_updated_at: string | null;
  /** True when Postgres was unreachable and this is a stale disk snapshot. */
  degraded?: boolean;
}

export interface MarketTrends {
  updated_at: string | null;
  filters_applied: Record<string, unknown>;
  total_leads: number;
  total_market_value_ron: number;
  average_opportunity_score: number | null;
  by_county: { county: string; count: number; value_ron: number; heat_index: number }[];
  by_category: { category: string; count: number; value_ron: number }[];
  by_funding_source: { funding_source: string; count: number; value_ron: number }[];
  top_opportunities: {
    /** Powers the "?openLead=" click-through to Căutare Avansată. */
    source_id?: string;
    project_title: string;
    entity_name: string;
    county: string;
    category: string;
    /** Quick-filtered by the "Surse de finanțare" panel, same as county/
     *  category are by their own panels — see MarketTrendsView.tsx. */
    funding_source: string;
    financial_value_ron: number;
    opportunity_score: number | null;
    /** Why this row is in the list, and how it's ranked (by match_strength
     *  when there's a real profile to rank against, opportunity_score
     *  otherwise — see routers/analysis.py). Only present on
     *  /me/market-trends (Prima Pagina); the public /analysis/market-trends
     *  route has no profile to match against. */
    match?: {
      /** Internal ranking weight, NOT a 0-10 score — never render this. */
      score: number;
      /** The real 0-10-bounded number — this is "Scor potrivire". */
      match_strength: number;
      is_match: boolean;
      excluded: boolean;
      reasons: string[];
    } | null;
  }[];
  /** False for anonymous callers — top_opportunities is empty in that case. */
  is_authenticated: boolean;
  /** Only on GET /api/v1/me/market-trends — false when the profile currently
   *  matches nothing and this response fell back to the full market. */
  is_personalized?: boolean;
  ai_strategic_report?: string | null;
  ai_report_locked?: boolean;
  degraded?: boolean;
  detail?: string;
}

export interface MarketTrendFilters {
  start_date?: string;
  end_date?: string;
  counties?: string[];
  categories?: string[];
  funding_sources?: string[];
  keywords?: string[];
  min_value_ron?: number;
  max_value_ron?: number;
  limit?: number;
  include_ai_report?: boolean;
}

export interface OpportunityPage {
  items: MarketTrends["top_opportunities"];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  is_authenticated: boolean;
}

export interface Deal {
  deal_id: string;
  opportunity_id?: string | null;
  project_title: string;
  stage: string;
  target_margin_pct?: number | null;
  estimated_value_ron?: number | null;
  proposed_price?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string | null;
  stage_history?: { from: string | null; to: string; at: string }[];
  /** The tender's own facts, joined from the register (null when the deal
   *  was saved from a source the database no longer holds). */
  opportunity?: {
    source_url?: string | null;
    action_deadline?: string | null;
    published_date?: string | null;
    opportunity_score?: number | null;
    authority_cui?: string | null;
    entity_name?: string | null;
    county?: string | null;
    cpv_code?: string | null;
    category?: string | null;
    procedure_type?: string | null;
    award_criterion?: string | null;
  } | null;
  /** Statutory countdowns computed from the facts above — see
   *  legal_kb.tender_deadlines. Never a guess at a date only the authority
   *  knows. */
  deadlines?: TenderDeadline[];
  /** Documents generated for this tender (exports, caiet scans). */
  artifacts?: ArtifactSummary[];
  win_probability?: {
    probability: number;
    stage_weight: number;
    fit_factor: number;
    match_score: number | null;
    competition_factor: number;
    competition_basis: string;
    formula: string;
  };
}

export interface TenderDeadline {
  key: "submission" | "clarification_answers" | "documentation_challenge";
  label: string;
  date: string;
  days_left: number;
  basis: string;
  note?: string | null;
}

export type ArtifactKind =
  | "propunere_tehnica" | "clarification" | "evaluation_response" | "abnormally_low_price"
  | "dossier_access" | "foia" | "caiet_scan" | "price_justification";

export interface ArtifactSummary {
  artifact_id: string;
  source_id: string | null;
  kind: ArtifactKind;
  title: string;
  created_at: string;
  label?: string;
}

export interface Artifact extends ArtifactSummary {
  payload: Record<string, unknown>;
}

export async function fetchArtifacts(sourceId?: string): Promise<{ available: boolean; artifacts: ArtifactSummary[] }> {
  const q = sourceId ? `?source_id=${encodeURIComponent(sourceId)}` : "";
  return apiFetch(`/api/v1/me/artifacts${q}`);
}

export async function fetchArtifact(artifactId: string): Promise<Artifact> {
  return apiFetch(`/api/v1/me/artifacts/${encodeURIComponent(artifactId)}`);
}

export async function deleteArtifact(artifactId: string): Promise<{ status: string }> {
  return apiFetch(`/api/v1/me/artifacts/${encodeURIComponent(artifactId)}`, { method: "DELETE" });
}

/** The bidder's own identity, looked up once and reused in every header. */
export interface CompanyProfile {
  cui?: string | null;
  company_name?: string | null;
  registration_number?: string | null;
  address?: string | null;
  legal_representative?: string | null;
  representative_role?: string | null;
  caen_code?: string | null;
  email?: string | null;
  phone?: string | null;
  updated_at?: string | null;
}

export async function fetchCompanyProfile(): Promise<{ available: boolean; profile: CompanyProfile | null }> {
  return apiFetch("/api/v1/me/company-profile");
}

export async function saveCompanyProfile(profile: CompanyProfile): Promise<{ status: string; persisted: boolean }> {
  return apiFetch("/api/v1/me/company-profile", { method: "PUT", body: profile });
}

/** Multi-CUI: the account's saved bidder firms and which one is active.
 *  `max` is the plan's limit (1, or 5 on Ofertant Complet Pro). */
export interface CompanyLibrary {
  available: boolean;
  active_cui: string | null;
  profiles: CompanyProfile[];
  max: number;
}

export async function fetchCompanyLibrary(): Promise<CompanyLibrary> {
  return apiFetch("/api/v1/me/company-profiles");
}

export async function addCompanyToLibrary(profile: CompanyProfile): Promise<{ status: string }> {
  return apiFetch("/api/v1/me/company-profiles", { method: "POST", body: profile });
}

export async function activateCompany(cui: string): Promise<{ status: string; profile: CompanyProfile }> {
  return apiFetch(`/api/v1/me/company-profiles/${encodeURIComponent(cui)}/activate`, { method: "POST" });
}

export async function deleteCompanyFromLibrary(cui: string): Promise<{ status: string }> {
  return apiFetch(`/api/v1/me/company-profiles/${encodeURIComponent(cui)}`, { method: "DELETE" });
}

/** Price percentiles of awarded / estimated value over comparable real
 *  awards (SEAP award notices), at the most specific CPV level and
 *  geography with a usable sample. */
export interface AwardBenchmark {
  available: boolean;
  sample_size: number;
  reason?: string;
  scope_label?: string;
  geography?: "county" | "national";
  cpv_prefix?: string | null;
  /** p10/p90 are what the market profile shows; p5/p95 cut the
   *  price-position bands. */
  ratio_pct?: { p5: number; p10: number; p25: number; p50: number; p75: number; p90: number; p95: number; iqr: number; mean: number };
  discount_pct?: { p5: number; p10: number; p25: number; p50: number; p75: number; p90: number; p95: number };
  below_80pct_share?: number;
  excluded_outliers?: number;
  /** Framework agreements left out of the price ratios (estimate = framework maximum). */
  excluded_frameworks?: number;
  single_offer?: { rate_pct: number | null; sample_size: number; note: string };
}

export interface AuthorityProfile {
  available?: boolean;
  reason?: string;
  authority_cui: string | null;
  authority_name: string | null;
  window_months: number;
  concentration: {
    available: boolean;
    awards: number;
    distinct_winners: number;
    total_awarded_ron?: number;
    hhi?: number;
    hhi_label?: string;
    hhi_note?: string;
    top_winner_share_pct?: number;
    top_winners?: { name: string; cui: string | null; awards: number; value_ron: number; share_pct: number }[];
  };
  single_offer: { rate_pct: number | null; sample_size: number; note: string };
  discount: AwardBenchmark;
  recent_awards: {
    published_at: string | null;
    title: string | null;
    winner_name: string | null;
    winner_cui: string | null;
    awarded_value_ron: number | null;
    estimated_value_ron: number | null;
    procedure_type: string | null;
    source_url: string | null;
  }[];
  by_contract_type: Record<string, number>;
  competition_factor?: { phi: number; basis: string };
}

export async function fetchAuthorityProfile(query: { cui?: string | null; name?: string | null }): Promise<AuthorityProfile> {
  const params = new URLSearchParams();
  if (query.cui) params.set("cui", query.cui);
  else if (query.name) params.set("name", query.name);
  return apiFetch(`/api/v1/market/authority-profile?${params.toString()}`);
}

export interface PipelineResponse {
  stages: string[];
  deals: Deal[];
}

export interface PipelineMetrics {
  total_deals: number;
  active_deals: number;
  won_deals: number;
  lost_deals: number;
  active_pipeline_value_ron: number;
  weighted_pipeline_value_ron: number;
  /** The same total weighted by stage alone, for comparison. */
  stage_weighted_value_ron?: number;
  won_value_ron: number;
  stage_breakdown: Record<string, { count: number; value_ron: number }>;
  average_days_in_stage: Record<string, number>;
  conversion_rates_pct: {
    discovery_to_bid_submitted: number | null;
    bid_submitted_to_won: number | null;
    overall_win_rate: number | null;
  };
  methodology_note: string;
}

export interface DealMutationResult {
  /** `already_saved` means this opportunity was already in the pipeline;
   *  the existing deal is returned rather than a second copy created. */
  status: "success" | "error" | "already_saved";
  deal?: Deal;
  message?: string;
  valid_stages?: string[];
  /** false when the deal landed in the in-process fallback because
   *  Postgres was unreachable — it will not survive a restart. */
  persisted?: boolean;
}

/* --------------------------------------------------------------- system */

export interface DatasetFreshness {
  last_synced_at: string | null;
  rows: number;
}

/** How current each dataset is (GET /system/freshness — public). */
export interface DataFreshness {
  generated_at: string;
  last_tick_at: string | null;
  datasets: Partial<Record<"tenders" | "funding_calls" | "award_outcomes" | "legal_watch", DatasetFreshness>>;
  legal: {
    checked_at: string | null;
    /** false = the bundled texts, not yet re-checked against the portal on this database. */
    synced: boolean;
    status?: string;
    thresholds_match?: boolean | null;
    acts?: Record<string, string | null>;
  };
}

export async function fetchDataFreshness(): Promise<DataFreshness> {
  return apiFetch("/api/v1/system/freshness", { anonymous: true });
}

/** The landing page's live counters (GET /system/public-stats — public,
 *  aggregates only). A count the database could not give is null: the page
 *  hides it rather than showing 0. */
export interface PublicStats {
  generated_at: string;
  available: boolean;
  open_procedures: number | null;
  pre_seap_signals: number | null;
  new_last_24h: number | null;
  registry_rows: number | null;
  award_outcomes: number | null;
  last_sync_at: string | null;
  legal_acts: number;
  legal_articles: number;
  legal_checked_at: string | null;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  return apiFetch("/api/v1/system/public-stats", { anonymous: true });
}

export async function fetchSystemStatus(): Promise<{
  last_tick_completed_at: string | null;
  minutes_since_last_tick: number | null;
  is_stale: boolean;
  degraded?: boolean;
}> {
  return apiFetch("/api/v1/system/status", { anonymous: true });
}

/* ----------------------------------------------------------------- auth */

export interface SyncedUser {
  user_id: string;
  email: string;
  full_name: string;
  /**
   * False when this user has signed in but hasn't set up their criteria
   * yet. AuthContext shows the onboarding form rather than an empty
   * dashboard.
   */
  onboarded: boolean;
  avatar_url?: string;
}

/** A user's own matching criteria and alert settings. */
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  domain: string | null;
  target_counties: string[];
  keywords: string[];
  exclude_keywords: string[];
  min_value_ron: number;
  company_name: string | null;
  cui: string | null;
  alert_email: string | null;
  min_alert_score: number | null;
  /** False after the one-click unsubscribe in an alert email. */
  email_alerts_enabled?: boolean | null;
  onboarded_at: string | null;
}

/**
 * Confirms the session against the backend and returns the canonical
 * profile. The backend now derives the identity from the verified JWT and
 * ignores the email in this body, so this call only succeeds for a real
 * signed-in session — it can no longer be used to mint a profile for an
 * arbitrary address.
 */
export async function syncBackendAuth(
  email: string,
  fullName?: string,
  avatarUrl?: string
): Promise<{ status: string; user: SyncedUser; profile: UserProfile | null }> {
  return apiFetch("/api/v1/auth/sync", {
    method: "POST",
    body: { email, full_name: fullName, avatar_url: avatarUrl },
  });
}

export interface OnboardingProfile {
  display_name?: string;
  domain: string;
  target_counties: string[];
  min_value_ron: number;
  keywords: string[];
  exclude_keywords: string[];
  /** Optional, and only for paperwork that names a legal entity. */
  company_name?: string;
  cui?: string;
  /** Collected on the same form as the matching criteria. Optional; the
   *  backend defaults it the same way PUT /api/v1/me/alert-settings does
   *  (7.5) when omitted. */
  min_alert_score?: number;
  /** Only meaningful on the initial signup call — see completeOnboarding. */
  consent_accepted?: boolean;
}

/** This user's own profile. There is no route for anyone else's. */
export async function fetchMyProfile(): Promise<{
  user_id: string;
  email: string;
  onboarded: boolean;
  profile: UserProfile | null;
}> {
  return apiFetch("/api/v1/me");
}

/** One-time setup after a first sign-in. Returns the configured profile. */
export async function completeOnboarding(
  profile: OnboardingProfile
): Promise<{ status: string; profile: UserProfile }> {
  return apiFetch("/api/v1/me/onboarding", { method: "POST", body: profile });
}

/** Change the watch criteria later. */
export async function updateMyProfile(
  profile: OnboardingProfile
): Promise<{ status: string; profile: UserProfile }> {
  return apiFetch("/api/v1/me/profile", { method: "PUT", body: profile });
}

/**
 * Where automated alerts actually go and at what score they fire — separate
 * from the criteria because it's a different concern. Before this existed
 * the Settings modal wrote only to localStorage, so changing it had no
 * effect on real alert dispatch.
 */
export async function updateMyAlertSettings(
  settings: { alert_email: string; min_alert_score: number }
): Promise<{ status: string }> {
  return apiFetch("/api/v1/me/alert-settings", { method: "PUT", body: settings });
}

export interface AlertPreferences {
  alert_email: string;
  min_alert_score: number;
  email_alerts_enabled: boolean;
  account_email: string | null;
}

/** The alert settings as the server holds them — the only copy alerts use. */
export async function fetchMyPreferences(): Promise<AlertPreferences> {
  return apiFetch("/api/v1/me/preferences");
}

export interface Entitlements {
  plan: string;
  plan_label: string;
  features: {
    pipeline_max_deals: number | null;
    csv_export: boolean;
    caiet_semantic_ai?: boolean;
    company_profiles_max?: number;
  };
}

/** The plan and what it includes beyond AI credits (pipeline size, CSV). */
export async function fetchEntitlements(): Promise<Entitlements> {
  return apiFetch("/api/v1/me/entitlements");
}

/**
 * Self-serve GDPR erasure — irreversible. Deletes the profile row; the
 * database cascades everything keyed to it (saved deals, their history,
 * the alert log). Also asks Supabase to remove the auth.users row when the
 * backend has a service-role key configured; `auth_identity_deleted` says
 * whether that half actually happened.
 */
export async function deleteOwnAccount(): Promise<{ status: string; auth_identity_deleted: boolean }> {
  return apiFetch("/api/v1/me", { method: "DELETE" });
}

/* ----------------------------------------------------------------- feed */

/**
 * The whole market, ranked so this user's matches come first.
 *
 * A soft filter: nothing is hidden. Each lead carries a `match` object
 * explaining its position, so a card can be badged with the reason rather
 * than the ordering being unexplained.
 */
export interface FeedFilters {
  /** Accepts "RO 14056826" or "14056826" — the backend normalises both. */
  authorityCui?: string;
  procedureType?: string;
  awardCriterion?: string;
  /** Any of these județe (OR); diacritics-tolerant on the server. */
  counties?: string[];
  fundingSource?: string;
}

/**
 * Unlike the profile criteria (which only re-rank), these three are hard
 * filters server-side: they're an explicit narrowing the user just
 * performed, so ignoring one would be the bug.
 */
export async function fetchMyFeed(
  category?: string,
  forceRefresh = false,
  filters: FeedFilters = {}
): Promise<FeedResponse> {
  return apiFetch(
    "/api/v1/me/feed" +
      qs({
        force_refresh: forceRefresh,
        category: category && category !== "all" ? category : undefined,
        authority_cui: filters.authorityCui?.trim() || undefined,
        procedure_type: filters.procedureType || undefined,
        award_criterion: filters.awardCriterion || undefined,
        counties: filters.counties?.length ? filters.counties.join(",") : undefined,
        funding_source: filters.fundingSource && filters.fundingSource !== "all" ? filters.fundingSource : undefined,
      })
  );
}

/**
 * The one full record, for LeadDossierPanel when it's opened from a
 * slimmer projection (top_opportunities on Prima Pagina/Analiza de Piață)
 * that doesn't carry every field the dossier shows. Not scoped to a
 * user's own ranked feed, unlike fetchMyFeed — a lead on screen in
 * Analiza de Piață's whole-market view could sit outside any one
 * profile's ranked top-300.
 */
export async function fetchOpportunity(sourceId: string): Promise<Lead> {
  return apiFetch(`/api/v1/me/opportunities/${encodeURIComponent(sourceId)}`);
}

/**
 * Display names for `Lead.procedure_type`. Keys are the backend's closed
 * vocabulary (ai_refinery.PROCEDURE_TYPES) — a value not listed here is
 * rendered as-is rather than hidden, so a new backend type shows up as an
 * unstyled label instead of silently disappearing from the UI.
 */
export const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  licitatie_deschisa: "Licitație Deschisă",
  procedura_simplificata: "Procedură Simplificată",
  cumparare_directa: "Achiziție Directă",
  consultare_piata: "Consultare",
};

/**
 * Downloads the user's qualified leads as CSV.
 *
 * Goes through fetch + object URL rather than a plain <a download href>:
 * the export route is authenticated now, and a bare link cannot carry an
 * Authorization header, so the old link would just render a 401 page.
 */
/** The CSV of exactly what the register shows under these filters. */
export async function downloadMyCsv(
  filters: FeedFilters & { category?: string; q?: string; onlyMatches?: boolean } = {}
): Promise<void> {
  const res = await apiFetch<Response>(
    "/api/v1/me/export/csv" +
      qs({
        category: filters.category && filters.category !== "all" ? filters.category : undefined,
        authority_cui: filters.authorityCui?.trim() || undefined,
        procedure_type: filters.procedureType || undefined,
        counties: filters.counties?.length ? filters.counties.join(",") : undefined,
        funding_source: filters.fundingSource && filters.fundingSource !== "all" ? filters.fundingSource : undefined,
        q: filters.q?.trim() || undefined,
        only_matches: filters.onlyMatches || undefined,
      }),
    { raw: true }
  );
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "RO-INTEL-export.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------- analysis */

export async function fetchMarketTrends(filters: MarketTrendFilters = {}): Promise<MarketTrends> {
  return apiFetch(`/api/v1/analysis/market-trends${qs({ ...filters })}`);
}

/** The real, paginated "see everything" list behind market-trends'
 *  results panel — same filters, but not capped to the ~25-row preview
 *  top_opportunities deliberately is. Powers pagination on both /analysis
 *  and Prima Pagina's profile-criteria results. */
export async function fetchOpportunitiesPage(filters: MarketTrendFilters = {}, page = 1, pageSize = 20): Promise<OpportunityPage> {
  return apiFetch(`/api/v1/analysis/opportunities${qs({ ...filters, page, page_size: pageSize })}`);
}

/** The same aggregation, scoped to the signed-in user's own matches — see
 *  `is_personalized` on the response for whether it actually is (a profile
 *  matching nothing falls back to the full market rather than an empty
 *  page). Powers Prima Pagina once a user is onboarded. */
export async function fetchMyMarketTrends(): Promise<MarketTrends> {
  return apiFetch("/api/v1/me/market-trends");
}

export interface CopilotTurn {
  role: "user" | "assistant";
  content: string;
}

/** What the user has on screen when they ask the floating copilot. The
 *  tender is re-read from the database by id on the server. */
export interface CopilotScreenContext {
  route?: string;
  source_id?: string | null;
  deal_id?: string | null;
  company?: { cui?: string | null; company_name?: string | null };
}

export type CopilotActionType =
  | "open_tender"
  | "add_to_pipeline"
  | "move_pipeline_stage"
  | "set_company_profile"
  | "open_drafting"
  | "open_strategy"
  | "send_email_alert";

/** An action the copilot proposes. Never executed by the server: the
 *  browser performs it, as the user, once they press the button. */
export interface CopilotAction {
  id: string;
  type: CopilotActionType;
  label: string;
  params: {
    source_id?: string | null;
    deal_id?: string;
    stage?: string;
    document?: "propunere_tehnica" | "clarificari" | "justificare_pret" | "acces_dosar" | "cerere_544";
    points?: string[];
    project_title?: string;
    tool?: "profil_piata" | "scanner_caiet" | "pozitionare_pret";
    cui?: string;
    company_name?: string;
    address?: string | null;
    registration_number?: string | null;
    caen_code?: string | null;
  };
}

export interface CopilotTenderCard {
  source_id: string;
  project_title?: string;
  entity_name?: string;
  county?: string;
  financial_value_ron?: number | null;
  action_deadline?: string | null;
  published_date?: string | null;
}

export interface CopilotAgentReply {
  reply: string;
  actions: CopilotAction[];
  tenders: CopilotTenderCard[];
  deep?: boolean;
  notice?: string | null;
  /** Set when a credit or budget limit stopped the AI call — the reply is
   *  then the deterministic one, and this says why. */
  ai_quota?: string | null;
  degraded?: boolean;
}

/** `history` is the prior turns, oldest first; the backend keeps 12. */
export async function askCopilotAgent(
  query: string,
  history: CopilotTurn[],
  context: CopilotScreenContext,
  deep = false
): Promise<CopilotAgentReply> {
  return apiFetch("/api/v1/copilot/agent", {
    method: "POST",
    body: { query, history: history.slice(-12), context, deep },
  });
}

/* --------------------------------------------------------- AI credits */

/** This month's AI credits (backend ai_budget.ai_status). */
export interface AiUsage {
  plan: string;
  plan_label: string;
  limits: { deliverable: number; copilot: number };
  used: { deliverable: number; copilot: number };
  remaining: { deliverable: number; copilot: number };
  deep_copilot: boolean;
  resets_at: string;
  free_pool_exhausted: boolean;
  platform_paused: boolean;
}

export async function fetchAiUsage(): Promise<AiUsage> {
  return apiFetch("/api/v1/me/ai-usage");
}

/** A citation the post-check found missing or repealed in AI output. */
export interface LegalIssue {
  key: string;
  citation: string;
  problem: "missing" | "repealed";
  message: string;
}

/** One shared AI brief per tender (backend addons/tender_briefs.py). */
export interface TenderBrief {
  status: "ready" | "pending" | "missing" | "unavailable";
  brief: string | null;
  legal_issues?: LegalIssue[];
  /** Deterministic — computed from the law, never by the model. For a
   *  pre-SEAP signal only `not_applicable` and `note` are set. */
  legal_regime: LegalMetadata & { not_applicable?: boolean; note?: string };
  /** True when another user's generation or the nightly batch paid for it. */
  shared?: boolean;
  model?: string;
  ai_quota?: string | null;
}

export async function fetchTenderBrief(sourceId: string): Promise<TenderBrief> {
  return apiFetch(`/api/v1/me/opportunities/${encodeURIComponent(sourceId)}/brief`);
}

export async function generateTenderBrief(sourceId: string): Promise<TenderBrief> {
  return apiFetch(`/api/v1/me/opportunities/${encodeURIComponent(sourceId)}/brief`, { method: "POST" });
}

/* -------------------------------------------------------------- support */

/**
 * The AI support assistant on /suport. Distinct from askCopilotChat: this
 * one carries no feed context (it's guest-accessible) and is grounded in
 * guidance about what RO-INTEL actually does rather than
 * the caller's own registry. `degraded: true` means no LLM provider
 * answered — the reply is still safe to show (it points to direct email
 * support) rather than something the caller must special-case.
 */
export async function askSupportBot(
  message: string,
  history: CopilotTurn[] = []
): Promise<{ reply: string; degraded?: boolean }> {
  // Not `anonymous: true` — the backend route accepts both a signed-in and
  // a guest caller (optional_auth), so a logged-in visitor's token is sent
  // when one exists and simply omitted otherwise; apiFetch already handles
  // "no session" by finding no token to attach.
  return apiFetch("/api/v1/support/chat", {
    method: "POST",
    body: { message, history: history.slice(-12) },
  });
}

/* ------------------------------------------------------------- pipeline */

export async function fetchMyPipeline(): Promise<PipelineResponse> {
  return apiFetch("/api/v1/me/pipeline");
}

export async function fetchPipelineMetrics(): Promise<PipelineMetrics> {
  return apiFetch("/api/v1/me/pipeline/metrics");
}

export async function addLeadToPipeline(leadData: Lead | Record<string, unknown>): Promise<DealMutationResult> {
  return apiFetch("/api/v1/me/pipeline/deals", {
    method: "POST",
    body: { lead_data: leadData },
  });
}

export async function updatePipelineDeal(
  dealId: string,
  payload: { new_stage: string; notes?: string; proposed_price?: number }
): Promise<DealMutationResult> {
  return apiFetch(`/api/v1/me/pipeline/deals/${encodeURIComponent(dealId)}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deletePipelineDeal(dealId: string): Promise<{ status: string; deal_id: string }> {
  return apiFetch(`/api/v1/me/pipeline/deals/${encodeURIComponent(dealId)}`, { method: "DELETE" });
}

/* --------------------------------------------------------- notification */

/**
 * Sends the tender by id: the server builds the e-mail from its own record,
 * so the "Deschide dosarul complet" link always carries the canonical
 * source_id (and /cautare-avansata opens it whatever the user's filters).
 */
/** "Trimite-mi dosarul pe email": always to the signed-in account's own,
 *  verified address — the server decides, and says which in `recipient`. */
export async function triggerEmailAlert(
  sourceId: string
): Promise<{ status: "success" | "failed"; recipient: string; source_id: string }> {
  return apiFetch("/api/v1/notifications/send-email-alert", {
    method: "POST",
    body: { source_id: sourceId },
  });
}

/* -------------------------------------------------------------- add-ons */

/**
 * Note the shape: there is no "historical discount", "competitor list" or
 * "dispute rate" here, because the system has never ingested an award
 * result or a CNSC decision and refuses to report figures it cannot
 * evidence. What it does report is the market it actually observed and
 * arithmetic reference points off the published estimate. The previous UI
 * read `benchmark.*` and `pricing_recommendations.*`, which this endpoint
 * has not returned for some time — every one of those cells rendered blank.
 */
/** One of the procedures the market figures were actually computed over,
 *  carried so the UI can link to the dossier instead of leaving the reader
 *  to find a number back out of the register by hand. */
export interface ObservedProcedure {
  source_id?: string | null;
  project_title?: string | null;
  entity_name?: string | null;
  county?: string | null;
  financial_value_ron?: number | null;
  published_date?: string | null;
  authority_cui?: string | null;
}

/** Real outcomes, from ingested SEAP award notices (CAN). `available` is
 *  false — with a `reason` — whenever the sample is too small to report,
 *  which is the common case today: only direct acquisitions produce award
 *  notices in this pipeline. */
export interface AwardIntelligence {
  available: boolean;
  sample_size: number;
  awards_seen?: number;
  /** Awards whose notice published no separate estimate, so no discount
   *  can be derived from them. The SEAP direct-acquisition feed publishes
   *  only the awarded value, which makes this the common case. */
  awards_without_estimate?: number;
  min_sample_required?: number;
  reason?: string;
  winning_discount_pct?: { average: number; median: number; min: number; max: number };
  recurring_winners?: { name: string; awards: number; share_pct: number }[];
  authority_profiles?: {
    authority: string;
    awards_observed: number;
    distinct_winners: number;
    top_winner: string;
    top_winner_share_pct: number;
  }[];
  offers_per_procedure?: { average: number; sample: number } | null;
  competitive_pressure?: {
    label: string;
    code: string;
    detail: string;
    evidence: Record<string, number | null>;
    method_note: string;
  };
}

export interface CompetitorAnalysis {
  sector: string;
  county: string;
  estimated_budget_ron: number;
  observed_market: {
    comparable_procedures_ingested: number;
    in_requested_county: number;
    analysed_procedures?: number;
    /** Which set every figure below was computed over. A national
     *  fallback must never be readable as a local finding. */
    scope?: "county" | "national";
    scope_note?: string;
    contracting_authorities_observed: string[];
    /** The same authorities with CUI and procedure count, to open their
     *  award profile in place. */
    authorities?: { name: string; cui: string | null; procedures: number }[];
    procedures?: ObservedProcedure[];
    value_distribution_ron: { min: number; median: number; max: number; count: number };
  };
  pricing: {
    guidance: string;
    sector_technical_note?: string;
    /** Percentiles of what winners bid, applied to the user's value. Null
     *  until enough comparable awards are ingested — there is no fallback
     *  ladder, by design. */
    reference_points_ron: Record<string, number> | null;
    reference_points_note: string;
    /** Art. 136 alin. (4) HG 395/2016: always shown, it is law, not data. */
    statutory_threshold?: { ratio_pct: number; price_ron: number; basis: string; note: string } | null;
    percentiles?: {
      ratio_pct: NonNullable<AwardBenchmark["ratio_pct"]>;
      discount_pct: NonNullable<AwardBenchmark["discount_pct"]>;
      prices_ron: Record<string, number>;
      sample_size: number;
      scope_label: string;
      below_80pct_share?: number;
      single_offer?: AwardBenchmark["single_offer"];
    } | null;
    observed_winning_price_ron?: {
      at_median_observed_discount: number;
      median_discount_pct: number;
      sample_size: number;
    };
    observed_winning_price_note?: string;
  };
  award_intelligence?: AwardIntelligence;
  award_benchmark?: AwardBenchmark;
  data_limitations: string;
}

export async function fetchCompetitorAnalysis(
  category: string,
  county: string,
  budgetRon: number,
  opts: { cpvCode?: string | null; contractType?: "lucrari" | "produse" | "servicii" | null } = {}
): Promise<CompetitorAnalysis> {
  return apiFetch("/api/v1/addons/competitor-analysis", {
    method: "POST",
    body: {
      category, county, budget_ron: budgetRon,
      cpv_code: opts.cpvCode || undefined,
      contract_type: opts.contractType || undefined,
    },
  });
}

export interface CaietAnalysis {
  project_title?: string;
  bias_risk_level?: string;
  bias_score?: number;
  extracted_character_count?: number;
  recommended_action?: string;
  /**
   * When nothing matched, the engine returns a single sentinel entry with
   * severity "OK" rather than an empty list — rendering that as a finding
   * would report a clean document as a restrictive one.
   */
  detected_red_flags?: CaietFlag[];
  qualification_criteria?: {
    turnover_requirements?: string[];
    required_certifications?: string[];
    key_personnel_roles?: string[];
    mandatory_equipment?: string[];
    extraction_note?: string;
  };
  coverage_note?: string;
  /** Identity of the scanned text; the AI pass (fetchCaietInsight) is
   *  requested with it, and cached on it for every later scan. */
  document_sha256?: string;
  /** Art. 25 NZIA assessment when the object names a net-zero technology
   *  (art. 4 alin. (1) lit. (a)-(k) of Reg. 2024/1735); null otherwise. */
  net_zero?: NetZeroAssessment | null;
}

export interface NetZeroAssessment {
  technologies: string[];
  matched_terms: string[];
  /** null = value unknown. */
  above_eu_threshold: boolean | null;
  eu_threshold_ron?: number | null;
  documentation_mentions: string[];
  applies: boolean;
  bidder_obligations: string[];
  guidance: string[];
  legal_basis?: { citation: string; text: string; source_url: string }[];
}

/** One flagged clause. `clarification_paragraph` is ready to paste into
 *  an Art. 160 request — the clause, the objection, the provision. */
export interface CaietFlag {
  flag_id?: string;
  pattern: string;
  severity: string;
  tactical_advisory: string;
  matched_terms?: string[];
  excerpt?: string | null;
  legal_citations?: string[];
  clarification_paragraph?: string;
  legal_basis?: { citation: string; text: string; source_url: string }[];
}

export interface CaietContext {
  sourceId?: string | null;
  estimatedValueRon?: number | null;
  contractType?: ContractType | null;
  authorityName?: string | null;
}

export async function analyzeCaietSarcini(
  projectTitle: string,
  specificationText?: string,
  docId?: string,
  context: CaietContext = {}
): Promise<CaietAnalysis> {
  return apiFetch("/api/v1/addons/analyze-caiet", {
    method: "POST",
    body: {
      project_title: projectTitle,
      specification_text: specificationText,
      doc_id: docId,
      source_id: context.sourceId || undefined,
      estimated_value_ron: context.estimatedValueRon || undefined,
      contract_type: context.contractType || undefined,
      authority_name: context.authorityName || undefined,
    },
  });
}

/** One finding from the AI pass. Same shape as a regex flag where they
 *  overlap, so both forward into an art. 160 request the same way. */
export interface CaietTrap extends CaietFlag {
  issue: string;
  recommendation: string;
  legal_topic: string;
  source: "ai";
}

export interface CaietInsight {
  status: "ready" | "unavailable";
  reason?: string;
  summary?: { label: string; text: string }[];
  /** Only the categories the document actually states. */
  requirements?: { key: string; label: string; items: { text: string; quote: string | null }[] }[];
  traps?: CaietTrap[];
  /** Served from the per-document cache: no credit spent. */
  cached?: boolean;
  truncated?: boolean;
  document_sha256?: string;
  risk?: { score: number; level: "Scăzut" | "Moderat" | "Critic"; regex_score: number; ai_findings: number };
}

export async function fetchCaietInsight(body: {
  project_title: string;
  document_sha256?: string | null;
  doc_id?: string | null;
  source_id?: string | null;
  specification_text?: string | null;
  regex_flags?: string[];
  regex_score?: number | null;
}): Promise<CaietInsight> {
  return apiFetch("/api/v1/addons/caiet-insight", { method: "POST", body });
}

export async function uploadCaietFile(file: File, projectTitle: string, sourceId?: string | null): Promise<CaietAnalysis> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("project_title", projectTitle);
  if (sourceId) formData.append("source_id", sourceId);
  return apiFetch("/api/v1/addons/upload-caiet", { method: "POST", body: formData });
}

/**
 * A scanned PDF (no digital text layer) can't go through the synchronous
 * path above — /upload-caiet 422s and points here instead. This queues
 * the real render->OCR pipeline; poll fetchDocumentExtraction(doc_id)
 * until it's done, then call analyzeCaietSarcini(title, undefined, doc_id).
 */
export interface DocumentExtraction {
  doc_id: string;
  status: "queued" | "processing" | "done" | "failed";
  ocr_applied: boolean;
  error_message?: string | null;
}

export async function uploadCaietFileAsync(file: File): Promise<{ doc_id: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch("/api/v1/addons/upload-caiet-async", { method: "POST", body: formData });
}

export async function fetchDocumentExtraction(docId: string): Promise<DocumentExtraction> {
  return apiFetch(`/api/v1/addons/document-extractions/${docId}`);
}

/**
 * Deliberately not a probability: an assessment built from the law (the
 * 80% presumption, the criterion's legality) and, where enough awards are
 * ingested, from where the price sits among real winning bids.
 */
export type AwardCriterion = "lowest_price" | "best_value" | "best_cost" | "lowest_cost";

/** A rival bid at a fixed share of the estimate (85%, 80.01%, 75%). Under
 *  quality-based criteria `technical_gap_pts` > 0 is the technical lead
 *  you need over that rival; < 0 is the lead the rival needs over you. */
export interface RivalScenario {
  rival_ratio_pct: number;
  rival_price_ron: number;
  rival_presumed_low: boolean;
  outcome: string;
  your_price_points?: number;
  rival_price_points?: number;
  technical_gap_pts?: number;
  technical_gap_pct_of_technical_weight?: number | null;
  note?: string;
}

export interface ElementAuditItem {
  key: string;
  label: string;
  check: string;
  evidence: string;
  basis: string;
}

export interface PriceStrategy {
  status: "success" | "error";
  message?: string;
  regime?: LegalRegime;
  award_criterion?: AwardCriterion;
  award_criterion_label?: string;
  discount_pct?: number;
  ratio_pct?: number;
  price_weight_pct?: number;
  technical_weight_pct?: number;
  criterion_check?: { criterion: string | null; allowed: boolean; issues: string[]; basis: string; eu_threshold_ron?: number };
  guarantees?: LegalMetadata["guarantees"];
  scoring_model?: { formula: string; note: string; your_total_if_lowest?: number };
  scenarios?: RivalScenario[];
  lifecycle?: {
    discount_rate?: LegalMetadata["discount_rate"] | null;
    state_budget_funded: boolean;
    note?: string;
    rate_pct?: number;
    years?: number;
    annual_cost_ron?: number;
    present_value_operating_ron?: number;
    lifecycle_cost_ron?: number;
    formula?: string;
  };
  market_position?: {
    your_ratio_pct: number;
    band: "below_p5" | "p5_p25" | "p25_p75" | "above_p75";
    label: string;
    reference_prices_ron: Record<string, number>;
    scope_label?: string;
    sample_size?: number;
  } | null;
  /** Both statutory routes to a price clarification request: the 80%
   *  presumption (art. 136 alin. (4) HG 395/2016) and the element-level
   *  audit at any discount (alin. (1)). */
  abnormally_low_risk?: {
    level: string;
    code: "over_budget" | "presumption" | "near_threshold" | "no_presumption";
    detail: string;
    presumption_pct: number;
    threshold_ron: number | null;
    presumption_basis: string;
    element_audit_basis: string;
    track1: string;
    track2: string;
    ratio_pct?: number;
    presumption_triggered?: boolean;
    margin_to_threshold_ron?: number;
    legal_position: string;
    element_audit: ElementAuditItem[];
    requires_justification_dossier: boolean;
    legal_basis: { citation: string; text: string; source_url: string }[];
  };
}

export interface WinOdds {
  estimated_budget_ron: number;
  proposed_price_ron: number;
  discount_percentage: number;
  competitiveness_band: string;
  assessment: string;
  factors: string[];
  methodology_note: string;
  strategy?: PriceStrategy;
  legal_regime?: LegalMetadata;
  award_intelligence?: AwardIntelligence;
  award_benchmark?: AwardBenchmark;
}

export interface WinRateOptions {
  awardCriterion?: AwardCriterion;
  priceWeightPct?: number;
  county?: string;
  cpvCode?: string | null;
  regime?: LegalRegime | null;
  contractType?: ContractType | null;
  authorityLevel?: AuthorityLevel | null;
  authorityName?: string | null;
  intellectualServices?: boolean;
  annualOperatingCostRon?: number | null;
  lifecycleYears?: number | null;
  stateBudgetFunded?: boolean;
}

export async function predictWinRate(
  estimatedBudget: number,
  proposedPrice: number,
  hasLocalPartner = false,
  leadTimeDays = 30,
  opts: WinRateOptions = {}
): Promise<WinOdds> {
  return apiFetch("/api/v1/addons/predict-win-rate", {
    method: "POST",
    body: {
      estimated_budget_ron: estimatedBudget,
      proposed_price_ron: proposedPrice,
      has_local_partnership: hasLocalPartner,
      lead_time_days: leadTimeDays,
      award_criterion: opts.awardCriterion ?? "lowest_price",
      price_weight_pct: opts.priceWeightPct ?? 100,
      county: opts.county || undefined,
      cpv_code: opts.cpvCode || undefined,
      regime: opts.regime || undefined,
      contract_type: opts.contractType || undefined,
      authority_level: opts.authorityLevel || undefined,
      authority_name: opts.authorityName || undefined,
      intellectual_services: Boolean(opts.intellectualServices),
      annual_operating_cost_ron: opts.annualOperatingCostRon || undefined,
      lifecycle_years: opts.lifecycleYears || undefined,
      state_budget_funded: opts.stateBudgetFunded ?? true,
    },
  });
}

export interface JustificationDossier {
  title: string;
  subtitle: string;
  company_name: string;
  authority_name?: string | null;
  project_title: string;
  estimated_value_ron: number;
  proposed_price_ron: number;
  discount_pct: number;
  chapters: {
    letter: string;
    title: string;
    what_to_provide: string;
    supporting_evidence: string;
  }[];
  legal_basis: { citation: string; text: string; source_url: string }[];
  closing_note: string;
  narrative: string | null;
  narrative_available: boolean;
  narrative_note: string | null;
  ai_quota?: string | null;
  legal_issues?: LegalIssue[];
}

/** The Art. 210 defence. The outline is complete on its own — `narrative`
 *  is the AI draft and is null when no provider answers. */
export async function generateJustificationDossier(body: {
  company_name: string;
  project_title: string;
  estimated_value_ron: number;
  proposed_price_ron: number;
  authority_name?: string;
  cost_notes?: string;
  use_ai_expansion?: boolean;
}): Promise<JustificationDossier> {
  return apiFetch("/api/v1/addons/price-justification-dossier", { method: "POST", body });
}

/* ------------------------------------------------- qualification routes */

export interface QualificationScenarios {
  available: boolean;
  reason?: string;
  company?: {
    cui: number;
    name: string;
    county: string | null;
    caen_code: string | null;
    turnover_ron: number | null;
    employee_count: number | null;
    fiscal_year: number | null;
    is_inactive_taxpayer: boolean;
    vat_registered: boolean;
    cash_vat_scheme: boolean;
  };
  contract?: {
    estimated_value_ron: number | null;
    max_lawful_turnover_requirement_ron: number | null;
    ceiling_basis: string | null;
  };
  scenario_a_leader?: {
    status: "eligible" | "likely_eligible" | "at_risk" | "blocked" | "unknown";
    label: string;
    max_lawful_turnover_requirement_ron: number | null;
    required_turnover_ron: number | null;
    company_turnover_ron: number | null;
    findings: string[];
    blockers: string[];
    legal_basis: { citation: string; text: string; source_url: string }[];
  };
  scenario_b_partnership?: {
    label: string;
    supportable_share_pct: number | null;
    findings: string[];
    routes: {
      route: string;
      label: string;
      note: string;
      legal_basis: { citation: string; text: string; source_url: string }[];
    }[];
  };
  exclusion_review?: {
    grounds: {
      ground: string;
      citation: string | null;
      status: "pass" | "fail" | "unverified";
      detail: string;
      evidence_document: string;
    }[];
    verified_count: number;
    unverified_count: number;
    note: string;
  };
  recommendation?: string;
  method_note?: string;
}

export async function fetchQualificationScenarios(body: {
  cui_fiscal: string;
  estimated_value_ron: number;
  required_turnover_ron?: number;
  company_name?: string;
}): Promise<QualificationScenarios> {
  return apiFetch("/api/v1/business-eligibility/qualification-scenarios", { method: "POST", body });
}

/* ---------------------------------------------------------- eligibility */

export interface EligibilityRequest {
  company_name: string;
  cui_fiscal: string;
  /**
   * Optional since the backend now fills these from ANAF's own registers
   * whenever the CUI resolves. What is sent here is only the fallback for
   * a company the registry cannot answer for (too new to have filed, or a
   * legal form with no filing obligation).
   */
  caen_code?: string;
  turnover_ron?: number;
  employee_count?: number;
  county?: string;
  verify_with_registry?: boolean;
  /** Mandatory exclusion grounds under Legea 98/2016 Art. 164/165/167. */
  has_criminal_conviction?: boolean;
  has_unpaid_taxes?: boolean;
  is_insolvent?: boolean;
  has_professional_misconduct?: boolean;
}

/**
 * What ANAF's taxpayer register and the company's own filed balance sheet
 * say about a CUI. `verified: false` carries `error` and never a
 * fabricated company — an unreachable ANAF and an unknown code are both
 * reported as such rather than guessed at.
 */
export interface CompanyVerification {
  verified: boolean;
  found: boolean;
  cui?: number;
  cui_checksum_valid?: boolean;
  error?: string;
  checked_at?: string;
  sources?: string[];
  company?: {
    cui: number;
    company_name: string | null;
    trade_registry_number: string | null;
    caen_code: string | null;
    legal_form: string | null;
    registration_date: string | null;
    registration_status: string | null;
    address: string | null;
    county: string | null;
    locality: string | null;
    vat_registered: boolean;
    is_inactive_taxpayer: boolean;
    einvoice_registered: boolean;
  };
  financials?: {
    found: boolean;
    fiscal_year?: number;
    turnover_ron?: number | null;
    employee_count?: number | null;
    caen_description?: string | null;
    source?: string;
    error?: string;
  };
  name_match?: {
    compared: boolean;
    matches: boolean | null;
    confidence: number | null;
    official_name?: string;
    declared_name?: string;
  };
  /** Registry facts that bar participation, e.g. an inactive taxpayer. */
  registry_warnings?: string[];
}

export async function verifyCompany(cuiFiscal: string, companyName?: string): Promise<CompanyVerification> {
  return apiFetch("/api/v1/business-eligibility/verify-company", {
    method: "POST",
    body: { cui_fiscal: cuiFiscal, company_name: companyName },
  });
}

export interface EligibilityGrant {
  program_id: string;
  program_name: string;
  eligible_grant_up_to: string;
  required_co_financing: string;
  estimated_own_contribution_ron?: number;
  legal_basis: string;
  eligibility_score?: number;
  action_required?: string;
  /**
   * How closely the company's CAEN code matches the programme's list.
   * `depth: "exact"` is a listed code; anything shallower means the match
   * was inferred from the same class/division and eligibility is uncertain
   * — which the UI must show rather than presenting all matches as equal.
   */
  caen_match?: {
    depth: string;
    confidence: number;
    matched: string;
    note: string;
  };
}

export interface EligibilityResult {
  qualification_status?: string;
  overall_eligibility_score?: number;
  advisory_summary?: string;
  matched_programs_count?: number;
  matched_grants?: EligibilityGrant[];
  /** Plain sentences naming the article breached. Empty when clean. */
  exclusion_grounds?: string[];
  fx_rate_used?: number;
  company_profile?: {
    name: string;
    cui: string;
    caen: string;
    turnover_ron: number;
    turnover_eur: number;
    employee_count: number;
    county: string;
    development_region?: string;
    size_class?: string;
    is_imm?: boolean;
  };
  /** The registry lookup the verdict was computed from, when one ran. */
  registry_verification?: CompanyVerification & { skipped?: boolean; note?: string };
  /** Fields where what was typed disagreed with the official register. */
  declared_vs_registry?: { field: string; declared: unknown; registry: unknown; note: string }[];
  data_provenance?: string;
  [key: string]: unknown;
}

export async function evaluateBusinessEligibility(payload: EligibilityRequest): Promise<EligibilityResult> {
  return apiFetch("/api/v1/business-eligibility/evaluate", { method: "POST", body: payload });
}

/* ------------------------------------------------------------- drafting */

/* ------------------------------------------------------------- drafting */

export type ContractType = "lucrari" | "produse" | "servicii" | "servicii_sociale";

/** CPV division 45 is works; 03-44 and 48 supplies; the rest services —
 *  the CPV regulation's own split, mirrored from legal_kb.contract_type_from_cpv. */
export function contractTypeFromCpv(cpv: string | null | undefined): ContractType | null {
  const digits = (cpv || "").replace(/\D/g, "").slice(0, 2);
  if (digits.length < 2) return null;
  const division = Number(digits);
  if (division === 45) return "lucrari";
  if (division <= 44 || division === 48) return "produse";
  return "servicii";
}
export type LegalRegime = "L98" | "L99";
export type AuthorityLevel = "central" | "local";
export type DeclarationId =
  | "env_social"
  | "conflict_of_interest"
  | "confidentiality"
  | "exclusion"
  | "sanctions_5k"
  | "beneficial_owner"
  | "dnsh";
export type LetterType = "clarification" | "evaluation_response" | "abnormally_low_price" | "dossier_access" | "foia";

/** The "Subscrisa" block — who is bidding, as the authority must see it. */
export interface BidderIdentity {
  company_name?: string;
  cui?: string;
  trade_register_no?: string;
  headquarters?: string;
  legal_representative?: string;
  representative_role?: string;
}

/**
 * legal_kb.legal_metadata — computed server-side from the consolidated law,
 * never client-side: thresholds change by EU regulation (last on
 * 2026-01-01) and a second copy of the table here would drift.
 */
export interface LegalMetadata {
  regime: LegalRegime;
  regime_source: "auto" | "manual";
  regime_reason: string;
  regime_label: string;
  applicable_law: string;
  norme_metodologice: string;
  contract_type: ContractType;
  authority_level: AuthorityLevel;
  authority_level_source: "auto" | "manual" | "default";
  thresholds: {
    direct_award_ron: number;
    direct_award_basis: string;
    eu_ron: number;
    eu_basis: string;
    effective_from: string;
  };
  estimated_value_ron: number | null;
  band: "direct" | "simplified" | "eu" | null;
  procedure_name: string | null;
  procedure_basis: string | null;
  above_eu_threshold: boolean | null;
  /** Null for a direct award: its acts go to the administrative court
   *  (Legea 554/2004), not to the CNSC — see `direct_award`. */
  cnsc_deadline_days: number | null;
  cnsc_deadline_basis: string | null;
  cnsc_deadline_note?: string | null;
  cnsc_cautiune_ron: number | null;
  cautiune: {
    pre_submission_ron: number;
    pre_submission_cap_ron: number;
    post_submission_ron: number;
    post_submission_cap_ron: number;
    basis: string;
    note: string;
  } | null;
  warnings: string[];
  direct_award?: {
    tier: string;
    tiers: { direct_payment_below_ron: number; single_offer_max_ron: number; catalog_or_notice_above_ron: number };
    basis: string;
    challenge_forum: string;
    challenge_basis: string;
  };
  transitional_note?: string;
  guarantees?: {
    participation_max_pct: number;
    participation_max_ron: number | null;
    performance_max_pct: number;
    performance_max_ron: number | null;
    basis: string;
    note: string;
  };
  /** Art. 136 alin. (4) HG 395/2016 / art. 142 alin. (4) HG 394/2016. */
  abnormally_low?: {
    presumption_pct: number;
    threshold_ron: number | null;
    presumption_basis: string;
    element_audit_basis: string;
    track1: string;
    track2: string;
  };
  lowest_price_allowed?: boolean;
  lowest_price_basis?: string;
  /** Rata de actualizare (Ord. ANAP 12/2026) — life-cycle cost only. */
  discount_rate?: { year: number; rate_pct: number; basis: string; scope: string };
  /** When the legal data behind this strip was last verified against the
   *  portal, and whether the thresholds still match the law's text. */
  verification?: {
    checked_at: string | null;
    source: string;
    status: "ok" | "mismatch" | "partial";
    thresholds_match: boolean | null;
    issues: string[];
  };
}

export interface LegalRegimeRequest {
  estimated_value_ron?: number;
  contract_type?: ContractType;
  regime?: LegalRegime;
  authority_name?: string;
  authority_level?: AuthorityLevel;
  stage?: "pre_submission" | "post_submission";
}

export async function fetchLegalRegime(payload: LegalRegimeRequest): Promise<LegalMetadata> {
  return apiFetch("/api/v1/addons/legal-regime", { method: "POST", body: payload });
}

/** A quoted provision from the knowledge base (legal_kb.cite_with_text). */
export interface StatutoryCitation {
  key: string;
  citation: string;
  text: string;
  source_url: string;
}

/** One block of a generated document — the shape the .docx export writes. */
export interface DocumentSection {
  heading?: string;
  paragraphs: string[];
  table?: { caption?: string; columns: string[]; rows: string[][] };
  closing?: boolean;
  id?: string;
  ai_expanded?: boolean;
}

export interface ComplianceRow {
  requirement: string;
  response: string;
  reference: string;
  source?: "caiet";
  ai_grounded?: boolean;
}

export interface TechnicalProposalRequest {
  project_title: string;
  authority_name: string;
  county: string;
  category: string;
  company_name: string;
  cui: string;
  estimated_value_ron?: number;
  cpv_code?: string;
  source_id?: string;
  contract_type?: ContractType;
  regime?: LegalRegime;
  authority_level?: AuthorityLevel;
  bidder?: BidderIdentity;
  include_declarations?: DeclarationId[];
  decision_makers?: { name: string; role?: string }[];
  /** Rows for the beneficial-owner declaration (L129/2019 art. 4). */
  beneficial_owners?: { name: string; birth_date?: string; citizenship?: string; control?: string }[];
  /** Subcontractors/suppliers above 10% of the contract value (art. 5k). */
  sanctions_partners?: { name: string; role?: string; country?: string; share?: string }[];
  /** Populates the conformity matrix. Empty + source_id set = the backend
   *  uses the caiet already extracted for that notice, if any. */
  cerinte_caiet?: string;
  /** Deepens methodology/risk sections and drafts a "mod de îndeplinire"
   *  per caiet requirement via the LLM chain. Adds latency. */
  use_ai_expansion?: boolean;
  caiet_text?: string;
}

export interface TechnicalProposalResult {
  project_title: string;
  company_name: string;
  authority_name: string;
  cui?: string;
  source_id?: string;
  dossier_text: string;
  structured_sections?: DocumentSection[];
  compliance_rows?: ComplianceRow[];
  declarations?: (DocumentSection & { legal_basis?: StatutoryCitation[] })[];
  legal_metadata?: LegalMetadata;
  requirements_count?: number;
  requirements_source?: string | null;
  statutory_basis?: Record<string, StatutoryCitation[]>;
  disclaimer?: string;
  ai_expanded?: boolean;
  ai_quota?: string | null;
  legal_issues?: LegalIssue[];
  [key: string]: unknown;
}

export async function generateTechnicalProposal(payload: TechnicalProposalRequest): Promise<TechnicalProposalResult> {
  return apiFetch("/api/v1/addons/generate-technical-proposal", { method: "POST", body: payload });
}

export interface ClarificationRequest {
  authority_name: string;
  project_title: string;
  source_id: string;
  company_name: string;
  cui_fiscal: string;
  clarification_points: string;
  /**
   * One instrument per stage of a procedure — different legal bases,
   * deadlines and consequences, not variants of one letter. See
   * foia_generator.REQUEST_TYPES on the backend.
   */
  request_type?: LetterType;
  contact_email?: string;
  procedure_deadline?: string;
  estimated_value_ron?: number;
  contract_type?: ContractType;
  regime?: LegalRegime;
  authority_level?: AuthorityLevel;
  bidder?: BidderIdentity;
  evaluation_request_ref?: string;
  result_communication_date?: string;
  offered_price_ron?: number;
  price_breakdown?: Record<string, number>;
  foia_presets?: string[];
  use_ai_expansion?: boolean;
  caiet_text?: string;
}

export interface ClarificationResult {
  generated_letter: string;
  document_type?: string;
  doc_title?: string;
  recipient?: string;
  reference_id?: string;
  sections?: DocumentSection[];
  legal_basis?: string[];
  legal_basis_verified?: StatutoryCitation[];
  /** What the bidder must know but must NOT send — e.g. that a
   *  clarification request does not stop the challenge clock. */
  counsel_notes?: string[];
  legal_metadata?: LegalMetadata;
  disclaimer?: string;
  ai_quota?: string | null;
  legal_issues?: LegalIssue[];
  [key: string]: unknown;
}

export async function generateLegalClarification(payload: ClarificationRequest): Promise<ClarificationResult> {
  return apiFetch("/api/v1/addons/generate-clarification", { method: "POST", body: payload });
}

async function downloadDocx(path: string, payload: unknown, filename: string): Promise<void> {
  const res = await apiFetch<Response>(path, { method: "POST", body: payload, raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slug(text: string, fallback: string): string {
  const s = (text || "").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 60).replace(/^_+|_+$/g, "");
  return s || fallback;
}

export async function exportDossierDocx(payload: TechnicalProposalRequest): Promise<void> {
  return downloadDocx(
    "/api/v1/addons/export-dossier-docx",
    payload,
    `propunere_tehnica_${slug(payload.project_title, "oferta")}.docx`
  );
}

export async function exportClarificationDocx(payload: ClarificationRequest): Promise<void> {
  const kind = payload.request_type || "clarification";
  return downloadDocx(
    "/api/v1/addons/export-clarification-docx",
    payload,
    `${kind}_${slug(payload.project_title, "solicitare")}.docx`
  );
}

/* -------------------------------------------------------------- billing */

export interface BillingPlan {
  plan_id: string;
  name: string;
  price_ron: number;
  features?: string[];
  [key: string]: unknown;
}

export async function fetchBillingPlans(): Promise<BillingPlan[] | { plans: BillingPlan[] }> {
  return apiFetch("/api/v1/billing/plans", { anonymous: true });
}

export interface ProformaResult {
  invoice_number: string;
  plan_name: string;
  net_ron: number;
  vat_ron: number;
  total_ron: number;
  cui_fiscal: string;
  billing_interval: "monthly" | "annual";
  invoice_status: string;
  provisional_until: string | null;
  proforma_html: string;
  bank_details: {
    bank_name: string;
    iban_ron: string;
    beneficiary: string;
    cui: string;
    reg_com: string;
    address: string;
    payment_details_prefix: string;
  } | null;
  [key: string]: unknown;
}

/** Issues a numbered proforma (ROINTEL-PF-2026-0001). 503 while the
 *  seller's bank details are not configured on the server. */
export async function generateProformaInvoice(payload: {
  plan_id: string;
  company_name: string;
  cui_fiscal: string;
  billing_email: string;
  billing_address?: string;
  interval?: "monthly" | "annual";
}): Promise<ProformaResult> {
  return apiFetch("/api/v1/me/billing/proforma", { method: "POST", body: payload });
}

/** "Am plătit prin OP": provisional access (72 h) until the payment is
 *  confirmed. Once per 30 days. */
export async function declareBankTransfer(
  invoiceNumber: string
): Promise<{ status: string; invoice_number: string; provisional_until: string }> {
  return apiFetch(`/api/v1/me/billing/proforma/${encodeURIComponent(invoiceNumber)}/transfer-declared`, {
    method: "POST",
  });
}

/* -------------------------------------------------- push notifications */

export interface PushPublicKey {
  configured: boolean;
  public_key: string | null;
}

/** The VAPID application server key. Served by the backend rather than
 *  baked into the bundle so rotating it needs no frontend redeploy. */
export async function fetchPushPublicKey(): Promise<PushPublicKey> {
  return apiFetch("/api/v1/notifications/push/public-key", { anonymous: true });
}

/** `subscription` is the browser's own PushSubscription.toJSON(). */
export async function subscribeToPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<{ status: string }> {
  return apiFetch("/api/v1/notifications/push/subscribe", { method: "POST", body: subscription });
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ status: string }> {
  return apiFetch("/api/v1/notifications/push/unsubscribe", { method: "POST", body: { endpoint } });
}

export async function updatePushPreferences(
  prefs: { push_enabled?: boolean; push_radar_enabled?: boolean }
): Promise<{ status: string }> {
  return apiFetch("/api/v1/notifications/push/preferences", { method: "PUT", body: prefs });
}

/** Fires a real notification at this user's registered devices. Push has an
 *  unusually long list of ways to be silently off (OS Do Not Disturb, a
 *  denied permission, an iOS PWA never added to the Home Screen) that the
 *  server cannot see, so the UI offers one button that either produces a
 *  notification or names what failed. */
export async function sendTestPush(): Promise<{ status: string; delivered: number; devices: number }> {
  return apiFetch("/api/v1/notifications/push/test", { method: "POST" });
}

/* ---------------------------------------------------------- stripe */

export interface BillingConfig {
  stripe_enabled: boolean;
  annual_months_charged: number;
  currency: string;
}

export async function fetchBillingConfig(): Promise<BillingConfig> {
  return apiFetch("/api/v1/billing/config", { anonymous: true });
}

export interface CheckoutResult {
  /** "success" carries checkout_url; "unavailable" means Stripe is not
   *  configured yet and the UI must fall back to the proforma flow. */
  status: "success" | "unavailable" | "error";
  checkout_url?: string;
  session_id?: string;
  message?: string;
  plan_id?: string;
  interval?: string;
  amount_ron?: number;
}

export async function createCheckoutSession(
  planId: string,
  interval: "monthly" | "annual" = "monthly"
): Promise<CheckoutResult> {
  return apiFetch("/api/v1/billing/checkout", {
    method: "POST",
    body: { plan_id: planId, interval },
  });
}

export interface SubscriptionState {
  status: string;
  is_active: boolean;
  plan_id: string | null;
  current_period_end: string | null;
}

export async function fetchMySubscription(): Promise<SubscriptionState> {
  return apiFetch("/api/v1/billing/subscription");
}
