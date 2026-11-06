"use client";
import { Badge } from "@/components/newsprint";
import type { LegalMetadata } from "@/lib/api";
import { formatNumber } from "@/lib/format";

const CONTRACT_LABEL: Record<string, string> = {
  lucrari: "lucrări",
  produse: "produse",
  servicii: "servicii",
  servicii_sociale: "servicii sociale și specifice",
};

/**
 * The statutory frame of one procedure, as `legal_kb.legal_metadata`
 * computed it: which law, which authority category, which contract type,
 * the EU threshold that pairing gets, and what follows from being above or
 * below it. Nothing here is computed in the browser — the threshold is the
 * lei amount fixed by law, never a currency conversion.
 */
export default function ProcedureThresholdCard({ meta, compact = false }: { meta: LegalMetadata; compact?: boolean }) {
  const th = meta.thresholds;
  if (!th) return null;
  const level = meta.regime === "L99" ? "entitate contractantă" : meta.authority_level === "local" ? "autoritate locală / județeană" : "autoritate centrală";
  const value = meta.estimated_value_ron;

  let badge: React.ReactNode = null;
  if (meta.band === "direct") {
    badge = <Badge tone="neutral">Achiziție directă · contestare în instanță</Badge>;
  } else if (meta.above_eu_threshold === true) {
    badge = <Badge tone="accent">Peste pragul UE · publicare JOUE obligatorie · contestație {meta.cnsc_deadline_days ?? 10} zile</Badge>;
  } else if (meta.above_eu_threshold === false) {
    badge = <Badge tone="neutral">Sub pragul UE · contestație {meta.cnsc_deadline_days ?? 7} zile</Badge>;
  }

  return (
    <div className={compact ? "mt-2" : "mt-3 border-t border-divider pt-2.5"}>
      <p className="font-mono text-[11px] leading-5 text-stock-500">
        Regim: {meta.applicable_law} · Categorie: {level} · Tip: {CONTRACT_LABEL[meta.contract_type] ?? meta.contract_type}
      </p>
      <p className="tabular text-[13px] leading-5 text-stock-600">
        {value ? <>Valoare estimată {formatNumber(value)} lei · </> : null}
        Prag UE aplicabil {formatNumber(th.eu_ron)} lei
        {th.eu_eur ? ` (${formatNumber(th.eu_eur)} EUR)` : ""}
        <span className="text-stock-500"> · în vigoare din {th.effective_from.split("-").reverse().join(".")}</span>
      </p>
      {badge && <div className="mt-1.5 flex flex-wrap gap-1.5">{badge}</div>}
      <p className="font-mono mt-1.5 text-[10px] leading-relaxed text-stock-500" title={meta.joue_basis || th.eu_basis}>
        {th.memo || "Prag oficial fixat în lei prin lege (Regulamentele delegate (UE) 2025/2150-2152), fără conversie valutară dinamică."}
      </p>
    </div>
  );
}
