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

export interface Lead {
  source_id: string;
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
  published_date?: string;
  action_deadline?: string;
  opportunity_score?: number;
  executive_summary?: string;
  sales_pitch_angle?: string;
  /**
   * Why this lead is where it is in the feed. Null when the user hasn't
   * onboarded yet (nothing to rank against). Computed by the ranking
   * query, not recomputed client-side.
   */
  match?: {
    score: number;
    is_match: boolean;
    excluded: boolean;
    reasons: string[];
  } | null;
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
    financial_value_ron: number;
    opportunity_score: number | null;
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
  min_value_ron?: number;
  max_value_ron?: number;
  limit?: number;
  include_ai_report?: boolean;
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
  status: "success" | "error";
  deal?: Deal;
  message?: string;
  valid_stages?: string[];
}

/* --------------------------------------------------------------- system */

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
  telegram_chat_id: string | null;
  min_alert_score: number | null;
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
  /** Collected on the same form as the matching criteria, so the full
   *  customization surface is set in one sitting. Both optional; the
   *  backend defaults them the same way PUT /api/v1/me/alert-settings
   *  does (7.5, no Telegram) when omitted. */
  min_alert_score?: number;
  telegram_chat_id?: string;
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
  settings: { alert_email: string; min_alert_score: number; telegram_chat_id?: string }
): Promise<{ status: string }> {
  return apiFetch("/api/v1/me/alert-settings", { method: "PUT", body: settings });
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
export async function fetchMyFeed(category?: string, forceRefresh = false): Promise<FeedResponse> {
  return apiFetch(
    "/api/v1/me/feed" +
      qs({
        force_refresh: forceRefresh,
        category: category && category !== "all" ? category : undefined,
      })
  );
}

/**
 * Downloads the user's qualified leads as CSV.
 *
 * Goes through fetch + object URL rather than a plain <a download href>:
 * the export route is authenticated now, and a bare link cannot carry an
 * Authorization header, so the old link would just render a 401 page.
 */
export async function downloadMyCsv(): Promise<void> {
  const res = await apiFetch<Response>("/api/v1/me/export/csv", { raw: true });
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

/** The same aggregation, scoped to the signed-in user's own matches — see
 *  `is_personalized` on the response for whether it actually is (a profile
 *  matching nothing falls back to the full market rather than an empty
 *  page). Powers Prima Pagina once a user is onboarded. */
export async function fetchMyMarketTrends(): Promise<MarketTrends> {
  return apiFetch("/api/v1/me/market-trends");
}

export interface MacroReport {
  period?: string;
  telemetry?: Record<string, unknown>;
  executive_takeaways?: string[];
  strategic_recommendation?: string;
}

export async function fetch72hMarketReport(): Promise<MacroReport> {
  return apiFetch("/api/v1/analytics/market-report-72h");
}

export async function askCopilotChat(query: string): Promise<{ reply: string; degraded?: boolean }> {
  return apiFetch("/api/v1/copilot/chat", { method: "POST", body: { query } });
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

/* --------------------------------------------------------- notification */

export async function triggerEmailAlert(
  leadData: Lead | Record<string, unknown>,
  recipientEmail: string
): Promise<{ status: "success" | "failed"; recipient: string }> {
  return apiFetch("/api/v1/notifications/send-email-alert", {
    method: "POST",
    body: { lead_data: leadData, recipient_email: recipientEmail },
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
export interface CompetitorAnalysis {
  sector: string;
  county: string;
  estimated_budget_ron: number;
  observed_market: {
    comparable_procedures_ingested: number;
    in_requested_county: number;
    contracting_authorities_observed: string[];
    value_distribution_ron: { min: number; median: number; max: number; count: number };
  };
  pricing: {
    guidance: string;
    sector_technical_note?: string;
    reference_points_ron: Record<string, number>;
    reference_points_note: string;
  };
  data_limitations: string;
}

export async function fetchCompetitorAnalysis(category: string, county: string, budgetRon: number): Promise<CompetitorAnalysis> {
  return apiFetch("/api/v1/addons/competitor-analysis", {
    method: "POST",
    body: { category, county, budget_ron: budgetRon },
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
  detected_red_flags?: { pattern: string; severity: string; tactical_advisory: string; matched_terms?: string[] }[];
  qualification_criteria?: {
    turnover_requirements?: string[];
    required_certifications?: string[];
    key_personnel_roles?: string[];
    mandatory_equipment?: string[];
    extraction_note?: string;
  };
  coverage_note?: string;
}

export async function analyzeCaietSarcini(projectTitle: string, specificationText: string): Promise<CaietAnalysis> {
  return apiFetch("/api/v1/addons/analyze-caiet", {
    method: "POST",
    body: { project_title: projectTitle, specification_text: specificationText },
  });
}

export async function uploadCaietFile(file: File, projectTitle: string): Promise<CaietAnalysis> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("project_title", projectTitle);
  return apiFetch("/api/v1/addons/upload-caiet", { method: "POST", body: formData });
}

/**
 * Deliberately not a probability. The engine states plainly that it holds
 * no award results and therefore cannot produce one; it returns a
 * qualitative band plus the reasoning behind it. The old UI printed
 * `win_probability_score` in 6xl type — a field this endpoint does not
 * return, so the headline number was permanently "undefined".
 */
export interface WinOdds {
  estimated_budget_ron: number;
  proposed_price_ron: number;
  discount_percentage: number;
  competitiveness_band: string;
  assessment: string;
  factors: string[];
  methodology_note: string;
}

export async function predictWinRate(
  estimatedBudget: number,
  proposedPrice: number,
  hasLocalPartner = false,
  leadTimeDays = 30
): Promise<WinOdds> {
  return apiFetch("/api/v1/addons/predict-win-rate", {
    method: "POST",
    body: {
      estimated_budget_ron: estimatedBudget,
      proposed_price_ron: proposedPrice,
      has_local_partnership: hasLocalPartner,
      lead_time_days: leadTimeDays,
    },
  });
}

/* ---------------------------------------------------------- eligibility */

export interface EligibilityRequest {
  company_name: string;
  cui_fiscal: string;
  caen_code: string;
  turnover_ron: number;
  employee_count: number;
  county: string;
  /** Mandatory exclusion grounds under Legea 98/2016 Art. 164/165/167. */
  has_criminal_conviction?: boolean;
  has_unpaid_taxes?: boolean;
  is_insolvent?: boolean;
  has_professional_misconduct?: boolean;
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
  [key: string]: unknown;
}

export async function evaluateBusinessEligibility(payload: EligibilityRequest): Promise<EligibilityResult> {
  return apiFetch("/api/v1/business-eligibility/evaluate", { method: "POST", body: payload });
}

/* ------------------------------------------------------------- drafting */

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
  /** Deepens methodology/risk sections via the LLM chain. Adds latency. */
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
  structured_sections?: { heading: string; paragraphs: string[] }[];
  compliance_rows?: unknown[];
  disclaimer?: string;
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
   * "clarification" = Legea 98/2016 request inside a live procedure.
   * "foia" = Legea 544/2001 public-information request. Different
   * instruments, different deadlines and appeal paths — not interchangeable.
   */
  request_type?: "clarification" | "foia";
  contact_email?: string;
  procedure_deadline?: string;
  use_ai_expansion?: boolean;
  caiet_text?: string;
}

export interface ClarificationResult {
  generated_letter: string;
  recipient?: string;
  reference_id?: string;
  disclaimer?: string;
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
  total_ron: number;
  cui_fiscal: string;
  proforma_html: string;
  bank_details: {
    bank_name: string;
    iban_ron: string;
    beneficiary: string;
    payment_details_prefix: string;
  };
  [key: string]: unknown;
}

export async function generateProformaInvoice(payload: {
  plan_id: string;
  company_name: string;
  cui_fiscal: string;
  billing_email: string;
  billing_address?: string;
}): Promise<ProformaResult> {
  return apiFetch("/api/v1/me/billing/proforma", { method: "POST", body: payload });
}
