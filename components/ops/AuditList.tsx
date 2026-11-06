"use client";

import { useState } from "react";
import type { OpsAuditEvent } from "@/lib/api";
import { Badge, Notice } from "@/components/newsprint";
import { formatDateTime } from "@/components/ops/OpsShell";
import { ACTOR_KINDS, actionLabel } from "@/components/ops/labels";

/** Audit events, newest first. Details are the sanitized summary the
 *  server stored (audit.sanitize) — rendered as text, never as HTML. */
export default function AuditList({ events, compact = false }: { events: OpsAuditEvent[]; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!events.length) return <Notice>Nicio acțiune înregistrată încă.</Notice>;
  return (
    <ul className="divide-y divide-divider rounded-xl border border-line-strong bg-paper">
      {events.map((e) => {
        const hasDetails = !compact && (Object.keys(e.details || {}).length > 0 || e.reason || e.request_id);
        return (
          <li key={e.id} className="px-4 py-2.5 text-[14px]">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="tabular text-[13px] text-stock-400">{formatDateTime(e.occurred_at)}</span>
              <span className="font-medium text-ink">{actionLabel(e.action)}</span>
              {e.outcome !== "success" && (
                <Badge tone={e.outcome === "denied" ? "warning" : "negative"}>{e.outcome === "denied" ? "Refuzat" : "Eșuat"}</Badge>
              )}
              <span className="text-stock-500">
                {e.actor_email || ACTOR_KINDS[e.actor_kind] || e.actor_kind}
                {e.actor_role ? ` · ${e.actor_role}` : ""}
              </span>
              {e.target_type && (
                <span className="font-mono text-[12px] text-stock-400">
                  {e.target_type}:{(e.target_id || "").slice(0, 36)}
                </span>
              )}
              {hasDetails && (
                <button
                  type="button"
                  onClick={() => setOpen(open === e.id ? null : e.id)}
                  aria-expanded={open === e.id}
                  className="ml-auto text-[13px] font-medium text-accent hover:underline"
                >
                  {open === e.id ? "Ascunde" : "Detalii"}
                </button>
              )}
            </div>
            {open === e.id && (
              <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-stock-600">
                {e.reason && <p><b className="font-semibold text-ink">Motiv:</b> {e.reason}</p>}
                {Object.keys(e.details || {}).length > 0 && (
                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[12px]">{JSON.stringify(e.details, null, 2)}</pre>
                )}
                {e.request_id && <p className="mt-1 font-mono text-[11px] text-stock-400">request {e.request_id}</p>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
