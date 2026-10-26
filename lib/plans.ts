/**
 * The three plans, as the price page, the pricing dialog and /abonament
 * show them. The amounts, credits and limits are the engine's
 * (romania-intel-engine/billing.py SUBSCRIPTION_PLANS, ai_budget.PLAN_AI_LIMITS,
 * entitlements.FEATURES) — tests/test_sprint4_product.py and
 * test_billing_stripe.py pin the same figures, so a change here without the
 * engine (or the reverse) fails CI rather than misquoting a price.
 */
export type PlanId = "free" | "plan_acces_complet" | "plan_founder_vip";

export interface PlanInfo {
  id: PlanId;
  name: string;
  /** Who it is for, one line. */
  pitch: string;
  monthly: number;
  annual: number;
  /** Shown next to the annual price. */
  annualNote?: string;
  badge?: string;
  features: string[];
}

export const PLANS: PlanInfo[] = [
  {
    id: "free",
    name: "Gratuit",
    pitch: "Registrul complet și instrumentele de bază, fără card.",
    monthly: 0,
    annual: 0,
    badge: "Pentru început",
    features: [
      "Registrul complet de licitații, cu filtre și scor",
      "Alerte pe email pentru licitațiile potrivite profilului",
      "Pipeline de ofertare: 10 dosare",
      "Scanner caiet de sarcini și simulator de preț",
      "2 documente AI .docx",
      "15 mesaje Copilot",
    ],
  },
  {
    id: "plan_acces_complet",
    name: "Strategie & Monitorizare",
    pitch: "Pentru firmele care urmăresc piața și depun lunar.",
    monthly: 490,
    annual: 4900,
    annualNote: "2 luni gratuite",
    features: [
      "Tot ce include contul gratuit",
      "Pipeline de ofertare nelimitat",
      "Statistici pe CPV și concentrarea pieței (HHI) pe autorități",
      "10 documente AI .docx pe lună",
      "100 mesaje Copilot pe lună",
      "Export CSV",
    ],
  },
  {
    id: "plan_founder_vip",
    name: "Ofertant Complet Pro",
    pitch: "Pentru echipele care pregătesc oferta cap-coadă.",
    monthly: 990,
    annual: 7900,
    annualNote: "tarif Fondator",
    badge: "Ofertare completă",
    features: [
      "Tot ce include Strategie & Monitorizare",
      "30 pachete complete .docx pe lună: propunere tehnică cu declarații, clarificări, justificări",
      "Analiză semantică AI a caietului de sarcini",
      "Copilot nelimitat (utilizare corectă: 1.000 mesaje pe lună)",
      "Profil multi-CUI pentru „Subscrisa” (până la 5 firme)",
    ],
  },
];

export const PAID_PLANS = PLANS.filter((p) => p.monthly > 0);

export function planById(id: string | null | undefined): PlanInfo | undefined {
  return PLANS.find((p) => p.id === id);
}

/** 4.900, 7.900, 13.050.935 — grouped from four digits up (the ro-RO
 *  locale leaves 4-digit numbers ungrouped, so 4900 and 13.050 would sit
 *  side by side on the same price card). */
export function formatLei(n: number): string {
  const [int, dec] = String(Math.abs(Math.round(n * 100) / 100)).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (n < 0 ? "-" : "") + grouped + (dec ? "," + dec : "");
}

/** The reassurance line under every price. */
export const PRICE_REASSURANCE = [
  "Prețuri în RON, fără TVA",
  "Factură fiscală B2B deductibilă",
  "Servere în UE",
  "Dezabonare cu un click",
  "Ștergere cont oricând",
];
