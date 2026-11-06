"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createOpsPromoCode,
  fetchOpsPromoCodes,
  fetchOpsPromoRedemptions,
  revealOpsPromoCode,
  revokeOpsPromoCode,
  type OpsPromoCode,
} from "@/lib/api";
import { Badge, Button, Checkbox, Field, Input, Loading, Notice, Select } from "@/components/newsprint";
import OpsShell, { ConfirmAction, SectionHead, Table, formatDateTime, useCan } from "@/components/ops/OpsShell";
import { PLAN_NAMES } from "@/components/ops/labels";

const STATUS: Record<OpsPromoCode["status"], { label: string; tone: "positive" | "neutral" | "warning" | "negative" }> = {
  active: { label: "Activ", tone: "positive" },
  exhausted: { label: "Epuizat", tone: "neutral" },
  expired: { label: "Expirat", tone: "warning" },
  revoked: { label: "Revocat", tone: "negative" },
};

function Codes() {
  const canManage = useCan("promo.manage");
  const canReveal = useCan("promo.reveal");
  const [all, setAll] = useState(false);
  const [codes, setCodes] = useState<OpsPromoCode[] | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revoking, setRevoking] = useState<OpsPromoCode | null>(null);
  const [endAccess, setEndAccess] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchOpsPromoCodes(all).then((r) => { setCodes(r.codes); setError(""); }).catch((e) => setError(e instanceof ApiError ? e.detail : "Codurile nu au putut fi încărcate."));
  }, [all]);
  useEffect(load, [load]);

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-ink">Coduri de acces</h1>
      <p className="mt-1 max-w-3xl text-[15px] leading-6 text-stock-500">
        Un cod acordă un plan pentru un număr de zile, de la activare. Nu este o reducere și nu atinge plata: un abonament plătit nu este nici înlocuit, nici scurtat.
        Reducerile procentuale sau fixe ar cere cupoane Stripe, care nu sunt conectate. Codurile apar mascate; integral doar la creare și la „Afișează” (înregistrat în jurnal).
      </p>

      {created && (
        <div className="mt-5">
          <Notice title="Cod creat — copiați-l acum">
            <span className="mt-1 block font-mono text-[18px] text-ink">{created}</span>
            <span className="mt-1 block">Trimiteți-l personal destinatarului. După închiderea acestui mesaj codul apare mascat.</span>
            <Button variant="ghost" className="mt-2 min-h-9 px-2 text-[13px]" onClick={() => setCreated(null)}>Am copiat codul</Button>
          </Notice>
        </div>
      )}

      {canManage && <CreateForm onCreated={(code) => { setCreated(code); load(); }} />}

      <SectionHead title="Coduri">
        <Checkbox label="Include revocate" checked={all} onChange={(e) => setAll(e.target.checked)} />
      </SectionHead>
      {error && <Notice tone="alert">{error}</Notice>}
      {!codes && !error && <Loading label="Se încarcă codurile" />}
      {codes && (
        <Table head={["Cod", "Plan · zile", "Utilizări", "Destinatar", "Stare", "Creat", ""]} empty="Niciun cod. Creați primul mai sus.">
          {codes.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2.5 font-mono text-[13px] text-ink">{revealed[c.id] || c.code_masked}</td>
              <td className="px-3 py-2.5 text-stock-600">{PLAN_NAMES[c.plan_granted] || c.plan_granted} · {c.duration_days} z</td>
              <td className="tabular px-3 py-2.5 text-stock-600">
                {c.times_redeemed} / {c.max_redemptions}
                {c.live_grants > 0 && <span className="block text-[12px] text-stock-400">{c.live_grants} cu acces activ</span>}
              </td>
              <td className="px-3 py-2.5 text-stock-600">{c.assigned_to || "—"}</td>
              <td className="px-3 py-2.5">
                <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                {c.expires_at && <span className="mt-1 block text-[12px] text-stock-400">poate fi activat până la {formatDateTime(c.expires_at)}</span>}
              </td>
              <td className="tabular px-3 py-2.5 text-stock-600">{formatDateTime(c.created_at)}</td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Button variant="ghost" className="min-h-9 px-2 text-[13px]" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                    {openId === c.id ? "Ascunde activări" : "Activări"}
                  </Button>
                  {canReveal && !revealed[c.id] && (
                    <Button
                      variant="ghost"
                      className="min-h-9 px-2 text-[13px]"
                      onClick={async () => {
                        try {
                          const r = await revealOpsPromoCode(c.id);
                          setRevealed((m) => ({ ...m, [c.id]: r.code }));
                        } catch (e) {
                          setError(e instanceof ApiError ? e.detail : "Codul nu a putut fi afișat.");
                        }
                      }}
                    >
                      Afișează
                    </Button>
                  )}
                  {canManage && (c.is_active || c.live_grants > 0) && (
                    <Button variant="danger" className="min-h-9 px-3 text-[13px]" onClick={() => { setEndAccess(!c.is_active); setRevoking(c); }}>
                      {c.is_active ? "Revocă" : "Încheie accesul"}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {openId && <Redemptions key={openId} id={openId} />}

      {revoking && (
        <ConfirmAction
          title={revoking.is_active ? "Revocați codul?" : "Încheiați accesul dat de cod?"}
          consequence={
            <>
              {revoking.is_active && <>Codul <span className="font-mono">{revoking.code_masked}</span> nu mai poate fi activat. </>}
              {endAccess
                ? <>Cele {revoking.live_grants} conturi cu acces activ din acest cod revin la planul lor propriu acum (un abonament plătit nu este afectat).</>
                : <>Accesul deja acordat ({revoking.live_grants} conturi) continuă până la data lui de final.</>}
            </>
          }
          extra={revoking.is_active && revoking.live_grants > 0 ? (
            <Checkbox label="Încheie și accesul deja acordat" checked={endAccess} onChange={(e) => setEndAccess(e.target.checked)} />
          ) : undefined}
          confirmLabel={endAccess ? "Revocă și încheie accesul" : "Revocă"}
          onCancel={() => setRevoking(null)}
          onConfirm={async (reason) => {
            await revokeOpsPromoCode(revoking.id, reason, endAccess);
            setRevoking(null);
            load();
          }}
        />
      )}
    </>
  );
}

function CreateForm({ onCreated }: { onCreated: (code: string) => void }) {
  const [plan, setPlan] = useState("pro");
  const [days, setDays] = useState("14");
  const [maxUses, setMaxUses] = useState("1");
  const [assigned, setAssigned] = useState("");
  const [campaign, setCampaign] = useState("FOUNDER");
  const [custom, setCustom] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const d = Number(days);
  const m = Number(maxUses);
  const valid = Number.isInteger(d) && d >= 1 && d <= 366 && Number.isInteger(m) && m >= 1 && m <= 1000;

  return (
    <form
      className="mt-6 rounded-xl border border-line-strong bg-paper p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setBusy(true);
        setError("");
        try {
          const res = await createOpsPromoCode({
            plan, days: d, max_uses: m,
            assigned_to: assigned.trim() || undefined,
            campaign: campaign.trim() || undefined,
            code: custom.trim() || undefined,
            code_expires_at: until ? new Date(`${until}T23:59:59`).toISOString() : undefined,
          });
          onCreated(res.code.code);
          setAssigned("");
          setCustom("");
        } catch (err) {
          setError(err instanceof ApiError ? err.detail : "Codul nu a putut fi creat.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[16px] font-semibold text-ink">Cod nou</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Plan acordat">
          <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="pro">Ofertant Complet Pro</option>
            <option value="strategie">Strategie & Monitorizare</option>
          </Select>
        </Field>
        <Field label="Zile de acces" hint="1–366, de la activare">
          <Input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <Field label="Utilizări maxime" hint="1 = cod personal; un cont îl poate folosi o singură dată">
          <Input inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
        </Field>
        <Field label="Poate fi activat până la" hint="Opțional">
          <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
        <Field label="Destinatar" hint="Persoană sau firmă; apare în cod">
          <Input value={assigned} onChange={(e) => setAssigned(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Campanie (prefix)" hint="ex. FOUNDER, PILOT">
          <Input value={campaign} onChange={(e) => setCampaign(e.target.value.toUpperCase())} maxLength={20} />
        </Field>
        <Field label="Cod ales manual" hint="Opțional; altfel se generează">
          <Input value={custom} onChange={(e) => setCustom(e.target.value.toUpperCase())} maxLength={64} spellCheck={false} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" fullWidth disabled={!valid || busy}>{busy ? "Se creează…" : "Creează codul"}</Button>
        </div>
      </div>
      {error && <div className="mt-3"><Notice tone="alert">{error}</Notice></div>}
    </form>
  );
}

function Redemptions({ id }: { id: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchOpsPromoRedemptions>>["redemptions"] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetchOpsPromoRedemptions(id).then((r) => setRows(r.redemptions)).catch((e) => setError(e instanceof ApiError ? e.detail : "Eroare."));
  }, [id]);
  return (
    <div className="mt-4">
      <SectionHead title="Activări" />
      {error && <Notice tone="alert">{error}</Notice>}
      {!rows && !error && <Loading label="Se încarcă activările" />}
      {rows && (
        <Table head={["Cont", "Activat", "Acces până la"]} empty="Codul nu a fost activat încă.">
          {rows.map((r) => (
            <tr key={r.user_id + r.redeemed_at}>
              <td className="px-3 py-2.5 text-ink">{r.email || r.user_id}</td>
              <td className="tabular px-3 py-2.5 text-stock-600">{formatDateTime(r.redeemed_at)}</td>
              <td className="tabular px-3 py-2.5 text-stock-600">{formatDateTime(r.access_expires_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

export default function OpsCodesPage() {
  return (
    <OpsShell>
      <Codes />
    </OpsShell>
  );
}
