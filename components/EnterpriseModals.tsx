"use client";
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ApiError, deleteOwnAccount, generateProformaInvoice, updateTenantAlertSettings, type ProformaResult } from "@/lib/api";
import { useAuth, tenantIdForDomain, type BusinessDesk } from "@/context/AuthContext";
import { Badge, Button, Eyebrow, Field, Input, Notice, Select } from "@/components/newsprint";

/* ------------------------------------------------------------ modal shell */

function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = "md",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          "neu-flat relative flex max-h-[92svh] w-full flex-col rounded-t-[32px] bg-paper sm:rounded-[32px] " +
          (size === "lg" ? "sm:max-w-4xl" : "sm:max-w-xl")
        }
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-divider p-4 sm:p-6">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold leading-tight tracking-tight">{title}</h2>
            {subtitle && <p className="font-body mt-1 text-sm leading-relaxed text-stock-600">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Închide"
            className="neu-flat-sm -mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-paper text-stock-500 transition-all duration-300 active:neu-pressed-sm"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- pricing */

const PLANS = [
  {
    id: "plan_acces_complet",
    name: "Acces Complet Desk",
    tier: "Standard",
    price: 499,
    features: [
      "Acces la toate registrele active de monitorizare",
      "Sinteze executive generate automat",
      "Export CSV al dosarelor calificate",
      "1 profil de monitorizare · 2 utilizatori",
    ],
  },
  {
    id: "plan_founder_vip",
    name: "VIP Multi-Divizie",
    tier: "Enterprise",
    price: 1499,
    features: [
      "Tot ce include pachetul Acces Complet",
      "Scanner caiet de sarcini (PDF / DOCX)",
      "Simulator șanse de câștig și marje",
      "Generator adrese Legea 544 și clarificări",
      "Radar concurență și propunere tehnică",
      "Până la 10 utilizatori",
    ],
  },
] as const;

export function PricingModal({
  isOpen,
  onClose,
  tenantId,
}: {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}) {
  const { user, activeDesk } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string>("plan_founder_vip");
  const [companyName, setCompanyName] = useState("");
  const [cui, setCui] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [proforma, setProforma] = useState<ProformaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from the active desk and the signed-in account rather than the
  // hardcoded demo company that used to ship here — a real customer should
  // never have to delete someone else's CUI before invoicing themselves.
  useEffect(() => {
    if (!isOpen) return;
    setCompanyName(activeDesk?.name || "");
    setCui(activeDesk?.cui || "");
    setEmail(user?.email || "");
    setError(null);
  }, [isOpen, activeDesk, user]);

  const plan = PLANS.find((p) => p.id === selectedPlan);

  const handleGenerate = async () => {
    if (!companyName.trim() || !cui.trim() || !email.trim()) {
      setError("Completați denumirea companiei, CUI-ul și emailul de facturare.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setProforma(
        await generateProformaInvoice({
          tenant_id: tenantId,
          plan_id: selectedPlan,
          company_name: companyName,
          cui_fiscal: cui,
          billing_email: email,
          billing_address: address || "România",
        })
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Nu s-a putut genera factura proformă.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!proforma?.proforma_html) return;
    const win = window.open("", "_blank");
    if (!win) {
      setError("Browserul a blocat fereastra de tipărire. Permiteți ferestrele pop-up și reîncercați.");
      return;
    }
    win.document.write(proforma.proforma_html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Abonament & Factură proformă"
      subtitle="Plata se face prin ordin de plată (OP) pe baza facturii proforme generate mai jos."
    >
      {!proforma ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {PLANS.map((p) => {
              const active = selectedPlan === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  aria-pressed={active}
                  className={
                    "flex flex-col rounded-3xl bg-paper p-5 text-left transition-all duration-300 " +
                    (active ? "neu-pressed border-l-[3px] border-editorial bg-editorial-soft" : "neu-flat hover:neu-lift")
                  }
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="label-eyebrow text-stock-500">{p.tier}</span>
                    {active && <span className="label-eyebrow text-editorial">Selectat</span>}
                  </div>
                  <h3 className="font-display mt-2 text-xl font-semibold leading-tight">{p.name}</h3>
                  <p className="tabular font-display mt-3 text-3xl font-semibold">
                    {p.price}
                    <span className="font-mono ml-1 text-xs font-normal tracking-widest text-stock-500">RON / LUNĂ</span>
                  </p>
                  <ul className="font-body mt-4 space-y-1.5 text-sm leading-relaxed text-stock-600">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span aria-hidden="true" className="text-editorial">—</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="neu-flat rounded-3xl bg-paper p-4 sm:p-5">
            <Eyebrow className="mb-4">Date de facturare</Eyebrow>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Denumire companie">
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" />
              </Field>
              <Field label="CUI / CIF">
                <Input value={cui} onChange={(e) => setCui(e.target.value)} placeholder="RO12345678" />
              </Field>
              <Field label="Email facturare">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </Field>
              <Field label="Adresă sediu social">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Str. …, Localitate" />
              </Field>
            </div>

            {error && (
              <div className="mt-4">
                <Notice tone="alert">{error}</Notice>
              </div>
            )}

            <Button onClick={handleGenerate} disabled={loading} fullWidth className="mt-5">
              {loading ? "Se emite proforma…" : `Emite proformă — ${plan?.price} RON`}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="neu-pressed rounded-r-lg border-l-2 border-editorial bg-editorial-soft px-4 py-3">
            <Eyebrow className="text-editorial">Proformă emisă</Eyebrow>
            <p className="font-display mt-1 text-xl font-semibold">{proforma.invoice_number}</p>
            <p className="font-body mt-1 text-sm text-stock-600">
              Total de plată: <b className="text-ink">{proforma.total_ron} RON</b> · {proforma.plan_name}
            </p>
          </div>

          <div className="scroll-x neu-pressed overflow-hidden rounded-2xl bg-paper">
            <table className="w-full border-collapse text-left font-mono text-xs">
              <tbody>
                {[
                  ["Bancă", proforma.bank_details?.bank_name],
                  ["IBAN", proforma.bank_details?.iban_ron],
                  ["Beneficiar", proforma.bank_details?.beneficiary],
                  [
                    "Detalii plată",
                    `${proforma.bank_details?.payment_details_prefix || ""}${proforma.invoice_number} (${proforma.cui_fiscal})`,
                  ],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-divider last:border-b-0">
                    <th scope="row" className="w-40 whitespace-nowrap border-r border-divider bg-surface px-3 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">
                      {label}
                    </th>
                    <td className="px-3 py-2.5 break-all">{value || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <Notice tone="alert">{error}</Notice>}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handlePrint} className="sm:flex-1">
              Tipărește / salvează PDF
            </Button>
            <Button variant="outline" onClick={() => setProforma(null)} className="sm:flex-1">
              Modifică datele
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------- account */

export function AccountSettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, preferences, updatePreferences, signInWithGoogle, signInWithEmail, signOut } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [scoreThreshold, setScoreThreshold] = useState(9.0);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAlertEmail(preferences?.notification_email || user?.email || "");
    setScoreThreshold(preferences?.auto_alert_score ?? 9.0);
    setSaved(false);
    setError(null);
    setDeleteConfirming(false);
    setDeleteError(null);
  }, [isOpen, preferences, user]);

  const handleDeleteAccount = async () => {
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOwnAccount();
      // The account no longer exists server-side — sign out locally
      // rather than leaving a session that would just fail on its next
      // authenticated request.
      await signOut();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.detail : "Ștergerea contului a eșuat. Reîncercați.");
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    // Local preferences drive the manual "trimite-mi acest dosar" button
    // and client-side display filtering; they're legitimate on their own.
    // But automated alerts (notifier.py's dispatch_lead_alert_to_tenant)
    // read tenants.alert_emails/min_alert_score from Postgres, not this —
    // saving only locally used to look successful while changing nothing
    // about where real alerts actually go.
    updatePreferences({ notification_email: alertEmail, auto_alert_score: Number(scoreThreshold) });
    if (!user?.tenant_id || !alertEmail.trim()) {
      setSaved(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateTenantAlertSettings(user.tenant_id, {
        alert_email: alertEmail.trim(),
        min_alert_score: Number(scoreThreshold),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Nu am putut salva preferințele de alertă.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (!emailInput.trim()) return;
    setAuthLoading(true);
    setError(null);
    const { error: err } = await signInWithEmail(emailInput);
    setAuthLoading(false);
    if (err) setError(err);
    else setMagicLinkSent(true);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cont & alerte"
      subtitle="Autentificare și configurarea notificărilor automate pentru dosarele cu scor ridicat."
    >
      <div className="space-y-6">
        {!user ? (
          <div className="neu-flat rounded-3xl bg-paper p-4 sm:p-5">
            <Eyebrow className="text-editorial">Neautentificat</Eyebrow>
            <p className="font-body mt-2 text-sm leading-relaxed text-stock-600">
              Conectați-vă pentru a accesa registrul, a salva dosare în pipeline și a primi alerte.
            </p>
            <Button onClick={signInWithGoogle} fullWidth className="mt-4">
              Continuă cu Google
            </Button>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-divider" />
              <span className="label-eyebrow text-stock-400">sau magic link</span>
              <span className="h-px flex-1 bg-divider" />
            </div>

            {magicLinkSent ? (
              <Notice title="Link expediat">
                Verificați căsuța <b>{emailInput}</b> și deschideți linkul de autentificare.
              </Notice>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="email"
                  placeholder="nume@exemplu.ro"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="sm:flex-1"
                  autoComplete="email"
                />
                <Button onClick={handleSendMagicLink} disabled={authLoading}>
                  {authLoading ? "Se trimite…" : "Trimite link"}
                </Button>
              </div>
            )}
            {error && (
              <div className="mt-3">
                <Notice tone="alert">{error}</Notice>
              </div>
            )}
          </div>
        ) : (
          <div className="neu-flat overflow-hidden rounded-3xl bg-paper">
            <table className="w-full border-collapse text-left font-mono text-xs">
              <tbody>
                {[
                  ["Cont", user.email],
                  ["Rol", user.role],
                  ["Profil intelligence", user.tenant_id],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-divider last:border-b-0">
                    <th scope="row" className="w-44 whitespace-nowrap border-r border-divider bg-stock-100 px-3 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">
                      {label}
                    </th>
                    <td className="break-all px-3 py-2.5">{value || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-divider p-3">
              <Button variant="danger" onClick={signOut} fullWidth>
                Deconectare
              </Button>
            </div>
          </div>
        )}

        {user && (
          <div className="neu-flat rounded-3xl bg-paper p-4 sm:p-5">
            <Eyebrow className="mb-2 text-negative">Zonă cu risc</Eyebrow>
            <p className="font-body mb-4 text-sm leading-relaxed text-stock-600">
              Ștergerea contului elimină definitiv profilul dvs. de căutare, criteriile de monitorizare și
              istoricul asociat. Nu poate fi anulată. Vezi{" "}
              <a href="/privacy" target="_blank" className="text-editorial underline underline-offset-2">
                Politica de Confidențialitate
              </a>
              .
            </p>
            {deleteError && (
              <div className="mb-3">
                <Notice tone="alert">{deleteError}</Notice>
              </div>
            )}
            {deleteConfirming && (
              <div className="mb-3">
                <Notice tone="warning" title="Confirmați ștergerea">
                  Această acțiune este ireversibilă. Apăsați din nou pentru a șterge definitiv contul.
                </Notice>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="danger" onClick={handleDeleteAccount} disabled={deleting} fullWidth>
                {deleting ? "Se șterge…" : deleteConfirming ? "Confirmă ștergerea definitivă" : "Șterge contul"}
              </Button>
              {deleteConfirming && !deleting && (
                <Button variant="outline" onClick={() => setDeleteConfirming(false)} fullWidth>
                  Anulează
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="neu-flat rounded-3xl bg-paper p-4 sm:p-5">
          <Eyebrow className="mb-4">Alerte email</Eyebrow>
          <div className="space-y-4">
            <Field label="Email destinatar notificări" hint="Adresa pe care o primesc alertele automate pentru dosarele cu scor ridicat.">
              <Input
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="nume@exemplu.ro"
              />
            </Field>
            <Field label="Prag minim scor pentru alertă">
              <Select value={scoreThreshold} onChange={(e) => setScoreThreshold(Number(e.target.value))}>
                <option value={9.5}>Scor ≥ 9.5 — doar proiecte strategice critice</option>
                <option value={9.0}>Scor ≥ 9.0 — toate oportunitățile calificate</option>
                <option value={8.5}>Scor ≥ 8.5 — toate semnalele active</option>
              </Select>
            </Field>
          </div>
          {error && (
            <div className="mt-4">
              <Notice tone="alert">{error}</Notice>
            </div>
          )}
          <Button onClick={handleSave} fullWidth className="mt-5" disabled={saving}>
            {saving ? "Se salvează…" : saved ? "Preferințe salvate" : "Salvează preferințele"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ desks */

const DOMAINS = [
  { id: "infrastructura", label: "Infrastructură & Transporturi" },
  { id: "sanatate", label: "Sănătate & Echipamente Medicale" },
  { id: "energie", label: "Energie & Utilități Verzi" },
  { id: "aparare", label: "Apărare & Securitate" },
  { id: "digitalizare", label: "Digitalizare, IT & Smart City" },
];

export function WorkspaceDeskModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { desks, activeDesk, createDesk, deleteDesk, switchDesk } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [cui, setCui] = useState("");
  const [domain, setDomain] = useState("infrastructura");
  const [counties, setCounties] = useState("Cluj, Iași, București");
  const [minBudget, setMinBudget] = useState(5000000);
  const [keywords, setKeywords] = useState("drum, pod, asfalt, consolidare");
  const [divisionName, setDivisionName] = useState("Divizia principală");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    if (!name.trim()) {
      setError("Completați o denumire pentru acest profil.");
      return;
    }
    const countyList = counties.split(",").map((c) => c.trim()).filter(Boolean);
    const keywordList = keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);

    const desk: Omit<BusinessDesk, "id"> = {
      name: name.trim(),
      cui: cui.trim() || undefined,
      primary_domain: domain,
      // Binds the desk to a real backend profile. Without this the feed
      // request carries an id the matching engine does not recognise and
      // returns nothing at all.
      tenant_id: tenantIdForDomain(domain),
      target_counties: countyList.length ? countyList : ["Toate"],
      min_budget_ron: Number(minBudget) || 1_000_000,
      keywords: keywordList,
      divisions: [{ id: "div_" + Date.now(), name: divisionName || "Divizia principală", keywords: keywordList }],
    };

    createDesk(desk);
    setIsCreating(false);
    setName("");
    setCui("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Profiluri de monitorizare"
      subtitle="Fiecare profil este legat de o configurație de intelligence care determină ce oportunități vă sunt arătate."
    >
      {!isCreating ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>{desks.length} profiluri configurate</Eyebrow>
            <Button onClick={() => setIsCreating(true)}>+ Adaugă profil</Button>
          </div>

          <div className="divide-y divide-divider neu-flat overflow-hidden rounded-3xl bg-paper">
            {desks.map((d) => (
              <div
                key={d.id}
                className={
                  "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between " +
                  (d.id === activeDesk?.id ? "bg-editorial-soft" : "")
                }
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold leading-tight">{d.name}</h3>
                    {d.id === activeDesk?.id && <Badge tone="accent">Activ</Badge>}
                  </div>
                  <p className="font-mono mt-1 text-[11px] text-stock-500">
                    {[d.cui, d.primary_domain, d.tenant_id].filter(Boolean).join(" · ")}
                  </p>
                  <p className="font-body mt-1 text-xs text-stock-600">
                    Județe: {d.target_counties?.join(", ") || "—"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {d.id !== activeDesk?.id && (
                    <Button variant="outline" onClick={() => switchDesk(d.id)}>
                      Comută
                    </Button>
                  )}
                  {desks.length > 1 && (
                    <Button variant="danger" onClick={() => deleteDesk(d.id)}>
                      Șterge
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Notice title="Notă">
            Profilurile sunt salvate local în acest browser. Nu sunt sincronizate între dispozitive.
          </Notice>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-divider pb-3">
            <Eyebrow>Profil nou</Eyebrow>
            <button onClick={() => setIsCreating(false)} className="text-sm font-medium text-editorial hover:brightness-110">
              ← Înapoi
            </button>
          </div>

          <Field label="Denumire profil">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Infrastructură & Transporturi" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cod fiscal (CUI) — opțional" hint="Completați doar dacă monitorizați în numele unei firme înregistrate.">
              <Input value={cui} onChange={(e) => setCui(e.target.value)} placeholder="RO34567890" />
            </Field>
            <Field label="Domeniu strategic" hint="Determină profilul de intelligence folosit la potrivire.">
              <Select value={domain} onChange={(e) => setDomain(e.target.value)}>
                {DOMAINS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Județe vizate" hint="Separate prin virgulă.">
            <Input value={counties} onChange={(e) => setCounties(e.target.value)} />
          </Field>

          <Field label="Cuvinte-cheie monitorizate" hint="Separate prin virgulă.">
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nume divizie principală">
              <Input value={divisionName} onChange={(e) => setDivisionName(e.target.value)} />
            </Field>
            <Field label="Buget minim proiect (RON)">
              <Input type="number" value={minBudget} onChange={(e) => setMinBudget(Number(e.target.value))} min={0} />
            </Field>
          </div>

          {error && <Notice tone="alert">{error}</Notice>}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleCreate} className="sm:flex-1">
              Salvează și activează
            </Button>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Anulează
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
