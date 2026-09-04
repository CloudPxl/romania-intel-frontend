"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { CATEGORIES, COUNTIES } from "@/lib/format";
import { Button, ChipSelect, Field, Input, Notice, Select } from "@/components/newsprint";

// Same numeric-only rule PUT /api/v1/me/alert-settings enforces server-side
// (api.py:_validate_alert_fields) — checked here too so a bad value is
// rejected immediately instead of round-tripping to the server first.
const TELEGRAM_CHAT_ID_PATTERN = /^-?\d{1,20}$/;

/**
 * Shown by AuthGate the first time someone signs in without criteria yet.
 * Deliberately asks nothing company-shaped (no CUI, no company name): just
 * the watch criteria that drives the feed ranking server-side, plus alert
 * settings — the full customization surface in one sitting, rather than
 * requiring a second visit to the criteria editor just to turn on
 * Telegram. The billing identity stays optional and lives in the criteria
 * editor, for the minority who need it on a generated document.
 */
export default function OnboardingForm() {
  const { completeOnboarding, updatePreferences } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [domain, setDomain] = useState<string>(CATEGORIES[0].id);
  const [counties, setCounties] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [minValue, setMinValue] = useState("");
  const [minAlertScore, setMinAlertScore] = useState(9.0);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const splitList = (value: string) =>
    value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const keywordList = splitList(keywords);
    if (keywordList.length === 0) {
      setError("Adăugați cel puțin un cuvânt-cheie, altfel nu veți primi nicio oportunitate relevantă.");
      return;
    }
    const chatId = telegramChatId.trim();
    if (chatId && !TELEGRAM_CHAT_ID_PATTERN.test(chatId)) {
      setError("ID-ul de chat Telegram trebuie să fie numeric (ex: 123456789), nu un @nume de utilizator.");
      return;
    }
    if (!consentAccepted) {
      setError("Trebuie să fiți de acord cu Termenii și Politica de Confidențialitate pentru a continua.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: apiError } = await completeOnboarding({
      display_name: displayName.trim() || undefined,
      domain,
      target_counties: counties,
      min_value_ron: minValue ? Number(minValue) : 0,
      keywords: keywordList,
      exclude_keywords: splitList(excludeKeywords),
      min_alert_score: minAlertScore,
      telegram_chat_id: chatId || undefined,
      consent_accepted: consentAccepted,
    });
    setSubmitting(false);
    if (apiError) {
      setError(apiError);
      return;
    }
    // The Settings modal reads its preview from this local, localStorage-
    // backed copy (the server row is authoritative for real alert
    // dispatch) — without this, opening it right after onboarding would
    // show its own defaults instead of what was just chosen here.
    updatePreferences({ auto_alert_score: minAlertScore, telegram_chat_id: chatId });
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 py-12 sm:py-20">
      <div className="mx-auto max-w-xl neu-flat rounded-3xl bg-paper p-6 sm:p-10">
        <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">Configurați-vă contul</h1>
        <p className="font-body mt-3 text-sm leading-relaxed text-stock-600">
          Sunteți autentificat. Ultimul pas: spuneți-ne ce oportunități vă interesează, ca să știm ce să vă arătăm.
          Puteți schimba aceste criterii oricând din setările contului.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <Field label="Numele dvs. (opțional)">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ion Popescu" />
          </Field>

          <Field label="Domeniu principal de interes">
            <Select value={domain} onChange={(e) => setDomain(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={
              counties.length
                ? `Județe de interes (${counties.length} selectate)`
                : "Județe de interes (opțional)"
            }
          >
            <ChipSelect
              options={COUNTIES}
              selected={counties}
              onChange={setCounties}
              emptyHint="Niciun județ selectat — veți vedea oportunități din toată țara."
            />
          </Field>

          <Field label="Cuvinte-cheie (separate prin virgulă)">
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="drum, pod, asfaltare"
              required
            />
          </Field>

          <Field label="Cuvinte de exclus (opțional, separate prin virgulă)">
            <Input value={excludeKeywords} onChange={(e) => setExcludeKeywords(e.target.value)} placeholder="curatenie, catering" />
          </Field>

          <Field label="Valoare minimă a contractului, RON (opțional)">
            <Input
              type="number"
              min="0"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              placeholder="0"
            />
          </Field>

          <Field label="Prag minim scor pentru alertă">
            <Select value={minAlertScore} onChange={(e) => setMinAlertScore(Number(e.target.value))}>
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

          <label className="flex min-h-[44px] cursor-pointer items-start gap-3 font-body text-sm text-ink">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              required
              className="neu-pressed-sm mt-0.5 h-5 w-5 shrink-0 appearance-none rounded-md bg-paper transition-all duration-300 checked:neu-flat-sm checked:[background:var(--color-editorial)]"
            />
            <span className="leading-snug text-stock-600">
              Sunt de acord cu{" "}
              <Link href="/terms" target="_blank" className="text-editorial underline underline-offset-2">
                Termenii și Condițiile
              </Link>{" "}
              și{" "}
              <Link href="/privacy" target="_blank" className="text-editorial underline underline-offset-2">
                Politica de Confidențialitate
              </Link>
              .
            </span>
          </label>

          {error && (
            <Notice tone="alert" title="Nu am putut configura contul">
              {error}
            </Notice>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
            {submitting ? "Se configurează..." : "Continuă"}
          </Button>
        </form>
      </div>
    </div>
  );
}
