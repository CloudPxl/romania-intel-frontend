/** Romanian labels for the console's closed vocabularies (audit.ACTIONS,
 *  ops_access.ROLE_LABELS). Unknown values fall back to the raw id. */
export const ACTION_LABELS: Record<string, string> = {
  "ops.access_denied": "Acces refuzat la consolă",
  "owner.bootstrap_issued": "Token de proprietar emis (server)",
  "owner.bootstrap_claimed": "Rol de proprietar revendicat",
  "owner.bootstrap_rejected": "Token de proprietar respins",
  "owner.bootstrap_cancelled": "Tokenuri de proprietar anulate (server)",
  "owner.revoked_via_cli": "Rol de proprietar încheiat (server)",
  "staff.invitation_created": "Invitație creată",
  "staff.invitation_revoked": "Invitație revocată",
  "staff.invitation_accepted": "Invitație acceptată",
  "staff.invitation_rejected": "Invitație respinsă",
  "staff.revoked": "Acces revocat",
  "user.viewed": "Profil de cont deschis",
  "user.suspended": "Cont suspendat",
  "user.restored": "Cont restabilit",
  "promo.created": "Cod creat",
  "promo.revealed": "Cod afișat integral",
  "promo.revoked": "Cod revocat",
  "promo.access_ended": "Acces din cod încheiat",
};

export const actionLabel = (a: string) => ACTION_LABELS[a] || a;

export const ACTOR_KINDS: Record<string, string> = {
  staff: "Consolă",
  server_cli: "Server (linie de comandă)",
  system: "Sistem",
  customer: "Cont client",
};

export const PLAN_NAMES: Record<string, string> = {
  free: "Gratuit",
  pro: "Ofertant Complet Pro",
  strategie: "Strategie & Monitorizare",
  plan_acces_complet: "Strategie & Monitorizare",
  plan_founder_vip: "Ofertant Complet Pro",
};

/** source_run_log.health_state (migrations/0004). */
export const HEALTH_STATES: Record<string, string> = {
  HEALTHY: "Funcțională",
  DEGRADED_EMPTY: "Fără rezultate",
  DOWN: "Căzută",
};

/** proforma_invoices.status (db.py). */
export const PROFORMA_STATUS: Record<string, string> = {
  issued: "Emisă",
  transfer_declared: "Transfer declarat",
  paid: "Plătită",
};
