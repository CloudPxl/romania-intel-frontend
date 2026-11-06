"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createOpsInvitation,
  fetchOpsStaff,
  revokeOpsInvitation,
  revokeOpsStaff,
  type OpsInvitation,
  type OpsRole,
  type OpsStaffMember,
} from "@/lib/api";
import { Badge, Button, Field, Input, Loading, Notice, Select } from "@/components/newsprint";
import OpsShell, { ConfirmAction, SectionHead, Table, formatDateTime, useCan, useOps } from "@/components/ops/OpsShell";

const CAP_LABELS: Record<string, string> = {
  "ops.view": "deschide consola",
  "health.view": "sănătatea sistemului",
  "health.view_errors": "textul erorilor tehnice",
  "metrics.view": "cifre de utilizare și comerciale",
  "users.view": "lista conturilor (emailuri mascate)",
  "users.view_pii": "date personale ale conturilor",
  "users.suspend": "suspendă / restabilește conturi",
  "promo.view": "codurile (mascate)",
  "promo.manage": "creează / revocă coduri",
  "promo.reveal": "afișează un cod integral",
  "staff.view": "cine are acces",
  "staff.manage": "invită / revocă acces",
  "audit.view": "jurnalul de audit",
};

type Data = { members: OpsStaffMember[]; invitations: OpsInvitation[]; roles: OpsRole[] };

function Staff() {
  const me = useOps();
  const canManage = useCan("staff.manage");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [revoking, setRevoking] = useState<OpsStaffMember | null>(null);
  // Set when the list loads, so "expired/open" is judged once per load.
  const [now, setNow] = useState(0);

  const load = useCallback(() => {
    fetchOpsStaff()
      .then((d) => {
        setData(d);
        setError("");
        setNow(Date.now());
      })
      .catch((e) => setError(e instanceof ApiError ? e.detail : "Lista nu a putut fi încărcată."));
  }, []);
  useEffect(load, [load]);

  const roleLabel = (id: string) => data?.roles.find((r) => r.id === id)?.label || id;

  return (
    <>
      <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-ink">Acces la consolă</h1>
      <p className="mt-1 max-w-3xl text-[15px] leading-6 text-stock-500">
        Cine poate deschide consola și ce poate face. Fiecare rol are doar permisiunile listate mai jos, verificate pe server la fiecare cerere.
        Rolul de proprietar nu se acordă și nu se retrage de aici: schimbarea lui se face pe server (procedura de recuperare).
      </p>

      {link && (
        <div className="mt-5">
          <Notice title={`Invitație pentru ${link.email} — copiați linkul acum`}>
            <span className="mt-1 block break-all font-mono text-[13px] text-ink">{link.url}</span>
            <span className="mt-1 block">Trimiteți-l personal. Este valabil 7 zile, o singură dată, doar pentru contul cu acest email. Consola nu trimite emailuri și nu îl mai afișează.</span>
            <Button variant="ghost" className="mt-2 min-h-9 px-2 text-[13px]" onClick={() => setLink(null)}>Am copiat linkul</Button>
          </Notice>
        </div>
      )}

      {canManage && data && <InviteForm roles={data.roles.filter((r) => r.invitable)} onCreated={(email, url) => { setLink({ email, url }); load(); }} />}

      {error && <div className="mt-4"><Notice tone="alert">{error}</Notice></div>}
      {!data && !error && <div className="mt-4"><Loading label="Se încarcă" /></div>}
      {data && (
        <>
          <SectionHead title="Persoane" />
          <Table head={["Persoană", "Rol", "De la", "Până la", "Stare", ""]}>
            {data.members.map((m) => {
              const expired = m.expires_at && new Date(m.expires_at).getTime() < now;
              return (
                <tr key={m.user_id}>
                  <td className="px-3 py-2.5 text-ink">{m.email}{m.user_id === me.user_id && <span className="ml-1 text-stock-400">(dvs.)</span>}</td>
                  <td className="px-3 py-2.5 text-stock-600">{roleLabel(m.role)}</td>
                  <td className="tabular px-3 py-2.5 text-stock-600">{formatDateTime(m.granted_at)}</td>
                  <td className="tabular px-3 py-2.5 text-stock-600">{m.expires_at ? formatDateTime(m.expires_at) : "nelimitat"}</td>
                  <td className="px-3 py-2.5">
                    {m.revoked_at ? <Badge tone="negative">Revocat</Badge> : expired ? <Badge tone="warning">Expirat</Badge> : <Badge tone="positive">Activ</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {canManage && !m.revoked_at && m.role !== "owner" && m.user_id !== me.user_id && (
                      <Button variant="danger" className="min-h-9 px-3 text-[13px]" onClick={() => setRevoking(m)}>Revocă</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>

          <SectionHead title="Invitații" note="Ultimele 50. Linkul nu mai poate fi afișat după creare." />
          <Table head={["Email", "Rol", "Creată", "Expiră", "Stare", ""]} empty="Nicio invitație.">
            {data.invitations.map((i) => {
              const open = !i.accepted_at && !i.revoked_at && new Date(i.expires_at).getTime() > now;
              return (
                <tr key={i.id}>
                  <td className="px-3 py-2.5 text-ink">{i.email}</td>
                  <td className="px-3 py-2.5 text-stock-600">{roleLabel(i.role)}</td>
                  <td className="tabular px-3 py-2.5 text-stock-600">{formatDateTime(i.created_at)}</td>
                  <td className="tabular px-3 py-2.5 text-stock-600">{formatDateTime(i.expires_at)}</td>
                  <td className="px-3 py-2.5">
                    {i.accepted_at ? <Badge tone="positive">Acceptată</Badge> : i.revoked_at ? <Badge tone="negative">Revocată</Badge> : open ? <Badge tone="accent">Deschisă</Badge> : <Badge>Expirată</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {canManage && open && (
                      <Button variant="ghost" className="min-h-9 px-3 text-[13px]" onClick={async () => {
                        try { await revokeOpsInvitation(i.id); load(); } catch (e) { setError(e instanceof ApiError ? e.detail : "Eroare."); }
                      }}>Revocă</Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>

          <SectionHead title="Roluri și permisiuni" note="Matricea aplicată de server (ops_access.ROLE_CAPABILITIES)." />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.roles.map((r) => (
              <div key={r.id} className="rounded-xl border border-line-strong bg-paper p-4">
                <p className="text-[15px] font-semibold text-ink">{r.label}{!r.invitable && r.id !== "owner" && <span className="ml-2 text-[12px] font-normal text-stock-400">încă indisponibil</span>}</p>
                {r.capabilities.length ? (
                  <ul className="mt-2 space-y-0.5 text-[13px] text-stock-600">
                    {r.capabilities.map((c) => <li key={c}>· {CAP_LABELS[c] || c}</li>)}
                  </ul>
                ) : (
                  <p className="mt-2 text-[13px] text-stock-500">Nicio permisiune în această consolă. Partenerii vor avea vederi proprii, limitate la resursele acordate explicit (etapa 3).</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {revoking && (
        <ConfirmAction
          title="Revocați accesul?"
          consequence={<><b>{revoking.email}</b> nu mai poate deschide consola, de la următoarea cerere. Contul de client rămâne neatins.</>}
          confirmLabel="Revocă accesul"
          onCancel={() => setRevoking(null)}
          onConfirm={async (reason) => {
            await revokeOpsStaff(revoking.user_id, reason);
            setRevoking(null);
            load();
          }}
        />
      )}
    </>
  );
}

function InviteForm({ roles, onCreated }: { roles: OpsRole[]; onCreated: (email: string, url: string) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles[0]?.id || "read_only");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = roles.find((r) => r.id === role);

  return (
    <form
      className="mt-6 rounded-xl border border-line-strong bg-paper p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const d = days.trim() ? Number(days) : undefined;
          const res = await createOpsInvitation({ email: email.trim(), role, note: note.trim() || undefined, access_days: d });
          onCreated(res.email, res.invite_url);
          setEmail("");
          setNote("");
        } catch (err) {
          setError(err instanceof ApiError ? err.detail : "Invitația nu a putut fi creată.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[16px] font-semibold text-ink">Invită o persoană</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="off" />
        </Field>
        <Field label="Rol">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </Select>
        </Field>
        <Field label="Acces pentru (zile)" hint="Gol = până la revocare">
          <Input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} placeholder="ex. 90" />
        </Field>
        <Field label="Notă internă" hint="Opțional, ex. motivul accesului">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
      </div>
      {selected && (
        <p className="mt-3 text-[13px] text-stock-500">
          {selected.label} poate: {selected.capabilities.map((c) => CAP_LABELS[c] || c).join(", ")}.
        </p>
      )}
      {error && <div className="mt-3"><Notice tone="alert">{error}</Notice></div>}
      <div className="mt-4">
        <Button type="submit" disabled={busy || !email.trim()}>{busy ? "Se creează…" : "Creează invitația"}</Button>
      </div>
    </form>
  );
}

export default function OpsStaffPage() {
  return (
    <OpsShell>
      <Staff />
    </OpsShell>
  );
}
