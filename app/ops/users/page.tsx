"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  fetchOpsUser,
  fetchOpsUsers,
  restoreOpsUser,
  suspendOpsUser,
  type OpsAuditEvent,
  type OpsUser,
  type OpsUserDetail,
} from "@/lib/api";
import { Badge, Button, Field, Input, Loading, Notice, Select } from "@/components/newsprint";
import OpsShell, { ConfirmAction, SectionHead, Table, ago, formatDateTime, useCan } from "@/components/ops/OpsShell";
import AuditList from "@/components/ops/AuditList";
import { PLAN_NAMES, PROFORMA_STATUS } from "@/components/ops/labels";

const STATUS_FILTERS = [
  { id: "", label: "Toate conturile" },
  { id: "paid", label: "Abonament plătit activ" },
  { id: "code", label: "Acces din cod activ" },
  { id: "not_onboarded", label: "Configurare neterminată" },
  { id: "suspended", label: "Suspendate" },
  { id: "tester", label: "Testeri" },
];

function StatusBadges({ u }: { u: OpsUser }) {
  return (
    <span className="flex flex-wrap gap-1">
      {u.suspended_at && <Badge tone="negative">Suspendat</Badge>}
      {u.is_staff && <Badge tone="accent">Echipă</Badge>}
      {!u.onboarded_at && <Badge>Neconfigurat</Badge>}
      {u.is_tester && <Badge>Tester</Badge>}
    </span>
  );
}

function Users() {
  const pii = useCan("users.view_pii");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<OpsUser[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async (append = false, before?: string) => {
    setError("");
    try {
      const res = await fetchOpsUsers({ q: q.trim() || undefined, status: status || undefined, before });
      setRows((prev) => (append && prev ? [...prev, ...res.users] : res.users));
      setMore(res.users.length === 50);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Lista nu a putut fi încărcată.");
    }
  }, [q, status]);

  useEffect(() => {
    load();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps -- search runs on submit, filter on change

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setSelected(id);
  }, []);

  const open = (id: string | null) => {
    setSelected(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("id", id);
    else url.searchParams.delete("id");
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-ink">Conturi</h1>
      <p className="mt-1 text-[15px] text-stock-500">
        {pii ? "Căutare după email, firmă, CUI sau id." : "Rolul dumneavoastră vede emailurile mascate; căutarea merge doar după id-ul contului."}
      </p>

      <form
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_260px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <Field label="Caută">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={pii ? "ana@firma.ro, Construct SRL, 12345678" : "id cont"} maxLength={100} />
        </Field>
        <Field label="Filtru">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </Select>
        </Field>
        <Button type="submit">Caută</Button>
      </form>

      <div className="mt-5">
        {error && <Notice tone="alert">{error}</Notice>}
        {!rows && !error && <Loading label="Se încarcă conturile" />}
        {rows && (
          // Phone: one card per account (a 6-column table would scroll sideways).
          <ul className="space-y-2 sm:hidden">
            {!rows.length && <li className="rounded-xl border border-line-strong bg-paper px-4 py-6 text-center text-stock-500">Niciun cont nu corespunde.</li>}
            {rows.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => open(u.id)}
                  className={`w-full rounded-xl border bg-paper px-4 py-3 text-left ${selected === u.id ? "border-editorial" : "border-line-strong"}`}
                >
                  <span className="block break-words font-medium text-ink">{u.email}</span>
                  {u.company_name && <span className="block text-[13px] text-stock-500">{u.company_name}</span>}
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-stock-500">
                    <span>{u.plan_label}</span>
                    <span>AI: {ago(u.last_ai_at)}</span>
                    <StatusBadges u={u} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {rows && (
          <div className="hidden sm:block">
          <Table head={["Cont", "Plan", "Stare", "Creat", "Ultima folosire AI", ""]} empty="Niciun cont nu corespunde.">
            {rows.map((u) => (
              <tr key={u.id} className={selected === u.id ? "bg-surface-2" : undefined}>
                <td className="px-3 py-2.5">
                  <span className="block font-medium text-ink">{u.email}</span>
                  {u.company_name && <span className="block text-[13px] text-stock-500">{u.company_name}{u.cui ? ` · CUI ${u.cui}` : ""}</span>}
                </td>
                <td className="px-3 py-2.5 text-stock-600">{u.plan_label}</td>
                <td className="px-3 py-2.5"><StatusBadges u={u} /></td>
                <td className="tabular px-3 py-2.5 text-stock-600">{formatDateTime(u.created_at)}</td>
                <td className="tabular px-3 py-2.5 text-stock-600">{ago(u.last_ai_at)}</td>
                <td className="px-3 py-2.5 text-right">
                  <Button variant="outline" className="min-h-9 px-3 text-[13px]" onClick={() => open(u.id)}>Deschide</Button>
                </td>
              </tr>
            ))}
          </Table>
          </div>
        )}
        {rows && more && (
          <div className="mt-3">
            <Button variant="outline" onClick={() => load(true, rows[rows.length - 1]?.created_at || undefined)}>Mai multe</Button>
          </div>
        )}
      </div>

      {selected && <UserPanel key={selected} id={selected} onClose={() => open(null)} onChanged={() => load()} />}
    </>
  );
}

function UserPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const canSuspend = useCan("users.suspend");
  const [data, setData] = useState<{ user: OpsUserDetail; history: OpsAuditEvent[] | null } | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"suspend" | "restore" | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    fetchOpsUser(id).then((d) => { setData(d); setError(""); }).catch((e) => setError(e instanceof ApiError ? e.detail : "Contul nu a putut fi încărcat."));
  }, [id]);
  useEffect(load, [load]);

  const u = data?.user;
  return (
    <div className="mt-8 rounded-xl border border-line-strong bg-paper p-5 sm:p-6" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-eyebrow text-stock-500">Cont</p>
          <h2 className="mt-1 break-words text-[20px] font-semibold text-ink">{u ? u.email : "…"}</h2>
          {u && <p className="mt-1 font-mono text-[12px] text-stock-400">{u.id}</p>}
        </div>
        <Button variant="ghost" onClick={onClose}>Închide</Button>
      </div>
      {error && <div className="mt-3"><Notice tone="alert">{error}</Notice></div>}
      {notice && <div className="mt-3"><Notice title="Aplicat">{notice}</Notice></div>}
      {!u && !error && <div className="mt-4"><Loading label="Se încarcă contul" /></div>}
      {u && (
        <>
          <dl className="mt-5 grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
            <Item k="Plan efectiv" v={u.plan_label} />
            <Item k="Abonament Stripe" v={u.subscription_status || "—"} />
            <Item k="Acces din cod" v={u.granted_plan ? `${PLAN_NAMES[u.granted_plan] || u.granted_plan} până la ${formatDateTime(u.granted_plan_expires_at)}` : "—"} />
            <Item k="Firmă" v={u.company_name ? `${u.company_name}${u.cui ? ` · CUI ${u.cui}` : ""}` : "—"} />
            <Item k="Domeniu" v={u.domain || "—"} />
            <Item k="Județe" v={u.target_counties?.length ? u.target_counties.join(", ") : "—"} />
            <Item k="Creat" v={formatDateTime(u.created_at)} />
            <Item k="Configurat" v={formatDateTime(u.onboarded_at)} />
            <Item k="Alerte email" v={u.email_alerts_enabled === false ? "Oprite" : u.email_alerts_enabled ? "Pornite" : "—"} />
          </dl>

          <SectionHead title="Activitate înregistrată" note="Ultimele 30 de zile, unde nu e altfel precizat." />
          <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-3 lg:grid-cols-5">
            <Item k="Dosare pipeline (total)" v={String(u.activity.deals)} />
            <Item k="Documente salvate (total)" v={String(u.activity.artifacts)} />
            <Item k="Apeluri AI" v={String(u.activity.ai_calls_30d)} />
            <Item k="Cost AI (USD)" v={u.activity.ai_cost_30d.toFixed(2)} />
            <Item k="Alerte trimise" v={String(u.activity.alerts_30d)} />
          </dl>

          {u.suspended_at && (
            <div className="mt-5">
              <Notice tone="alert" title={`Suspendat din ${formatDateTime(u.suspended_at)}`}>{u.suspended_reason || "Fără motiv înregistrat."}</Notice>
            </div>
          )}

          {(u.redemptions.length > 0 || u.proformas.length > 0) && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-[14px] font-semibold text-ink">Coduri activate</p>
                {u.redemptions.length ? (
                  <ul className="space-y-1 text-[14px] text-stock-600">
                    {u.redemptions.map((r) => (
                      <li key={r.redeemed_at}><span className="font-mono">{r.code}</span> · {formatDateTime(r.redeemed_at)} → {formatDateTime(r.access_expires_at)}</li>
                    ))}
                  </ul>
                ) : <p className="text-[14px] text-stock-400">Niciunul.</p>}
              </div>
              <div>
                <p className="mb-2 text-[14px] font-semibold text-ink">Proforme</p>
                {u.proformas.length ? (
                  <ul className="space-y-1 text-[14px] text-stock-600">
                    {u.proformas.map((p) => (
                      <li key={p.invoice_number}><span className="font-mono">{p.invoice_number}</span> · {p.amount_ron} lei · {PROFORMA_STATUS[p.status] || p.status}</li>
                    ))}
                  </ul>
                ) : <p className="text-[14px] text-stock-400">Niciuna.</p>}
              </div>
            </div>
          )}

          {canSuspend && !u.is_staff && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-divider pt-4">
              {u.suspended_at ? (
                <Button variant="outline" onClick={() => setConfirm("restore")}>Restabilește accesul</Button>
              ) : (
                <Button variant="danger" onClick={() => setConfirm("suspend")}>Suspendă contul</Button>
              )}
              <p className="w-full text-[13px] text-stock-500">
                Ștergerea datelor nu se face de aici: clientul își șterge singur contul (Cont › Setări), iar o cerere GDPR primită pe email urmează procedura din raportul consolei.
              </p>
            </div>
          )}

          {data?.history && (
            <>
              <SectionHead title="Istoric în jurnal" />
              <AuditList events={data.history} />
            </>
          )}
        </>
      )}

      {confirm && u && (
        <ConfirmAction
          title={confirm === "suspend" ? "Suspendați contul?" : "Restabiliți accesul?"}
          consequence={
            confirm === "suspend" ? (
              <>Orice sesiune a contului <b>{u.email}</b> este refuzată de API imediat (fiecare cerere primește „cont suspendat”). Nu se șterge nimic: profilul, dosarele și accesul plătit rămân și revin la restabilire. Alertele email nu se mai trimit cât timp este suspendat.</>
            ) : (
              <>Contul <b>{u.email}</b> poate folosi din nou aplicația, cu tot ce avea înainte.</>
            )
          }
          confirmLabel={confirm === "suspend" ? "Suspendă" : "Restabilește"}
          danger={confirm === "suspend"}
          expected={u.email}
          expectedLabel="Tastați emailul contului"
          onCancel={() => setConfirm(null)}
          onConfirm={async (reason, typed) => {
            if (confirm === "suspend") await suspendOpsUser(u.id, reason, typed);
            else await restoreOpsUser(u.id, reason, typed);
            setConfirm(null);
            setNotice(confirm === "suspend" ? "Contul a fost suspendat și acțiunea a fost înregistrată în jurnal." : "Accesul a fost restabilit și înregistrat în jurnal.");
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-stock-500">{k}</dt>
      <dd className="mt-0.5 break-words text-ink">{v}</dd>
    </div>
  );
}

export default function OpsUsersPage() {
  return (
    <OpsShell>
      <Users />
    </OpsShell>
  );
}
