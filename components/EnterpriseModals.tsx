"use client";
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ApiError, deleteOwnAccount, generateProformaInvoice, updateMyAlertSettings, type ProformaResult } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
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
    name: "Acces Complet",
    tier: "Standard",
    price: 499,
    features: [
      "Acces la toate registrele active de monitorizare",
      "Sinteze executive generate automat",
      "Export CSV al dosarelor calificate",
      "Profil de monitorizare propriu",
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
      "Suport prioritar",
    ],
  },
] as const;

export function PricingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string>("plan_founder_vip");
  const [companyName, setCompanyName] = useState("");
  const [cui, setCui] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [proforma, setProforma] = useState<ProformaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from the profile's own billing identity and the signed-in
  // account rather than the hardcoded demo company that used to ship here —
  // a real customer should never have to delete someone else's CUI before
  // invoicing themselves.
  useEffect(() => {
    if (!isOpen) return;
    setCompanyName(profile?.company_name || "");
    setCui(profile?.cui || "");
    setEmail(user?.email || "");
    setError(null);
  }, [isOpen, profile, user]);

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
  const { user, profile, preferences, updatePreferences, signInWithGoogle, signInWithEmail, signOut } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [scoreThreshold, setScoreThreshold] = useState(9.0);
  const [telegramChatId, setTelegramChatId] = useState("");
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
    setTelegramChatId(preferences?.telegram_chat_id || "");
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
    // But automated alerts (notifier.py's dispatch_lead_alert_to_user)
    // read alert_email/min_alert_score from Postgres, not this —
    // saving only locally used to look successful while changing nothing
    // about where real alerts actually go.
    updatePreferences({
      notification_email: alertEmail,
      auto_alert_score: Number(scoreThreshold),
      telegram_chat_id: telegramChatId,
    });
    if (!user || !alertEmail.trim()) {
      setSaved(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateMyAlertSettings({
        alert_email: alertEmail.trim(),
        min_alert_score: Number(scoreThreshold),
        // Always sent, so clearing the field genuinely clears it
        // server-side (the backend treats "" as "remove", and omitting
        // the key entirely as "leave untouched").
        telegram_chat_id: telegramChatId.trim(),
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
                  ["Domeniu urmărit", profile?.domain ? (DOMAINS.find((d) => d.id === profile.domain)?.label ?? profile.domain) : ""],
                  ["Județe", (profile?.target_counties || []).join(", ")],
                  ["Cuvinte-cheie", (profile?.keywords || []).join(", ")],
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
          <Eyebrow className="mb-4">Alerte automate</Eyebrow>
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
            <Field
              label="ID chat Telegram (opțional)"
              hint="Primiți aceleași alerte și pe Telegram. Deschideți @userinfobot în Telegram, care vă returnează ID-ul numeric al contului. Lăsați gol pentru a dezactiva."
            >
              <Input
                type="text"
                inputMode="numeric"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="123456789"
              />
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

/* -------------------------------------------------------------- criteria */

const DOMAINS = [
  { id: "infrastructura", label: "Infrastructură & Transporturi" },
  { id: "sanatate", label: "Sănătate & Echipamente Medicale" },
  { id: "energie", label: "Energie & Utilități Verzi" },
  { id: "aparare", label: "Apărare & Securitate" },
  { id: "digitalizare", label: "Digitalizare, IT & Smart City" },
];

/**
 * Edit the matching criteria after signup.
 *
 * This replaces a "desk manager" that maintained a browser-local list of
 * company profiles, each stamped with a backend tenant id. There is one
 * profile per user now, so there is nothing to manage — but editing the
 * criteria was genuinely unreachable before (the backend route existed and
 * nothing called it), so that is what this does instead.
 */
export function ProfileCriteriaModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { profile, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [domain, setDomain] = useState(DOMAINS[0].id);
  const [counties, setCounties] = useState("");
  const [keywords, setKeywords] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [minValue, setMinValue] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [cui, setCui] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !profile) return;
    setDisplayName(profile.display_name || "");
    setDomain(profile.domain || DOMAINS[0].id);
    setCounties((profile.target_counties || []).join(", "));
    setKeywords((profile.keywords || []).join(", "));
    setExcludeKeywords((profile.exclude_keywords || []).join(", "));
    setMinValue(profile.min_value_ron ? String(profile.min_value_ron) : "");
    setCompanyName(profile.company_name || "");
    setCui(profile.cui || "");
    setSaved(false);
    setError(null);
  }, [isOpen, profile]);

  const splitList = (value: string) =>
    value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  const handleSave = async () => {
    const keywordList = splitList(keywords);
    if (keywordList.length === 0) {
      setError("Păstrați cel puțin un cuvânt-cheie — fără el nu se poate calcula nicio potrivire.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: apiError } = await updateProfile({
      display_name: displayName.trim() || undefined,
      domain,
      target_counties: splitList(counties),
      min_value_ron: minValue ? Number(minValue) : 0,
      keywords: keywordList,
      exclude_keywords: splitList(excludeKeywords),
      company_name: companyName.trim() || undefined,
      cui: cui.trim() || undefined,
    });
    setSaving(false);
    if (apiError) setError(apiError);
    else setSaved(true);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Criterii de monitorizare"
      subtitle="Ce urmărim pentru dvs. Registrul afișează toată piața, dar ordonată după aceste criterii."
    >
      <div className="space-y-5">
        <Field label="Numele dvs. (opțional)">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ion Popescu" />
        </Field>

        <Field label="Domeniu principal de interes">
          <Select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {DOMAINS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Județe de interes (separate prin virgulă)">
          <Input value={counties} onChange={(e) => setCounties(e.target.value)} placeholder="Cluj, Iasi, Timis" />
        </Field>

        <Field
          label="Cuvinte-cheie (separate prin virgulă)"
          hint="Dovada obligatorie a unei potriviri. Județul și domeniul o întăresc, dar nu o pot crea singure."
        >
          <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="drum, pod, asfaltare" />
        </Field>

        <Field
          label="Cuvinte de exclus (opțional)"
          hint="Dosarele care le conțin coboară la baza registrului — nu sunt ascunse."
        >
          <Input
            value={excludeKeywords}
            onChange={(e) => setExcludeKeywords(e.target.value)}
            placeholder="curatenie, catering"
          />
        </Field>

        <Field label="Valoare minimă a contractului, RON (opțional)">
          <Input type="number" min="0" value={minValue} onChange={(e) => setMinValue(e.target.value)} placeholder="0" />
        </Field>

        <div className="neu-pressed rounded-2xl bg-paper p-4">
          <Eyebrow className="mb-3">Date de facturare (opțional)</Eyebrow>
          <p className="font-body mb-3 text-xs leading-relaxed text-stock-500">
            Folosite doar pentru a precompleta raportul de eligibilitate, documentele
            generate și factura proformă. Nu sunt necesare pentru monitorizare.
          </p>
          <div className="space-y-4">
            <Field label="Denumire companie">
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="SC Exemplu SRL" />
            </Field>
            <Field label="Cod fiscal (CUI)">
              <Input value={cui} onChange={(e) => setCui(e.target.value)} placeholder="RO12345678" />
            </Field>
          </div>
        </div>

        {error && <Notice tone="alert">{error}</Notice>}

        <Button onClick={handleSave} fullWidth disabled={saving}>
          {saving ? "Se salvează…" : saved ? "Criterii salvate" : "Salvează criteriile"}
        </Button>
      </div>
    </Modal>
  );
}
