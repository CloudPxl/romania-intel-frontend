"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, fetchOpsAudit, type OpsAuditEvent } from "@/lib/api";
import { Button, Field, Loading, Notice, Select } from "@/components/newsprint";
import OpsShell from "@/components/ops/OpsShell";
import AuditList from "@/components/ops/AuditList";

const FILTERS = [
  { id: "", label: "Toate acțiunile" },
  { id: "user.", label: "Conturi" },
  { id: "promo.", label: "Coduri" },
  { id: "staff.", label: "Acces echipă" },
  { id: "owner.", label: "Proprietar" },
  { id: "ops.access_denied", label: "Accese refuzate" },
];

function Audit() {
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [events, setEvents] = useState<OpsAuditEvent[] | null>(null);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);

  const load = useCallback(async (append = false, beforeId?: number) => {
    setError("");
    try {
      const r = await fetchOpsAudit({ action: action || undefined, outcome: outcome || undefined, before_id: beforeId });
      setEvents((prev) => (append && prev ? [...prev, ...r.events] : r.events));
      setMore(r.events.length === 50);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Jurnalul nu a putut fi încărcat.");
    }
  }, [action, outcome]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-ink">Jurnal de audit</h1>
      <p className="mt-1 max-w-3xl text-[15px] leading-6 text-stock-500">
        Fiecare acțiune din consolă, scrisă în aceeași tranzacție cu acțiunea: dacă înregistrarea nu reușește, acțiunea nu are loc. Jurnalul nu poate fi modificat sau șters din aplicație.
        Nu conține parole, tokenuri, chei sau coduri complete; adresele IP sunt păstrate doar ca hash.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-[260px_200px]">
        <Field label="Tip">
          <Select value={action} onChange={(e) => setAction(e.target.value)}>
            {FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </Select>
        </Field>
        <Field label="Rezultat">
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">Oricare</option>
            <option value="success">Reușite</option>
            <option value="denied">Refuzate</option>
            <option value="failed">Eșuate</option>
          </Select>
        </Field>
      </div>
      <div className="mt-5">
        {error && <Notice tone="alert">{error}</Notice>}
        {!events && !error && <Loading label="Se încarcă jurnalul" />}
        {events && <AuditList events={events} />}
        {events && more && (
          <div className="mt-3">
            <Button variant="outline" onClick={() => load(true, events[events.length - 1]?.id)}>Mai vechi</Button>
          </div>
        )}
      </div>
    </>
  );
}

export default function OpsAuditPage() {
  return (
    <OpsShell>
      <Audit />
    </OpsShell>
  );
}
