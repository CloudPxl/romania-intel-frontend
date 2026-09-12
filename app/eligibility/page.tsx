"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthGate from "@/components/AuthGate";
import Explain from "@/components/Explain";
import {
  ApiError,
  evaluateBusinessEligibility,
  fetchQualificationScenarios,
  verifyCompany,
  type CompanyVerification,
  type QualificationScenarios,
  type EligibilityResult,
} from "@/lib/api";
import { formatNumber, formatRon } from "@/lib/format";
import {
  Badge,
  Button,
  Checkbox,
  Eyebrow,
  Field,
  Input,
  Loading,
  Notice,
  NumberInput,
  PageHeader,
  Panel,
  SectionTitle,
} from "@/components/newsprint";

/**
 * Mandatory exclusion grounds under Legea 98/2016. A company that trips
 * any of these is barred from public procurement regardless of how well it
 * scores financially — the backend has always accepted these flags, but
 * the form never asked, so every scan was silently evaluated as if the
 * company were clean.
 */
const EXCLUSION_GROUNDS = [
  { key: "has_criminal_conviction", label: "Condamnare definitivă (Art. 164)" },
  { key: "has_unpaid_taxes", label: "Obligații fiscale restante (Art. 165)" },
  { key: "is_insolvent", label: "Insolvență / faliment (Art. 167)" },
  { key: "has_professional_misconduct", label: "Abatere profesională gravă (Art. 167)" },
] as const;

type ExclusionKey = (typeof EXCLUSION_GROUNDS)[number]["key"];

function EligibilityContent() {
  const { profile } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [cui, setCui] = useState("");
  const [caen, setCaen] = useState("4211");
  const [turnover, setTurnover] = useState(18500000);
  const [employees, setEmployees] = useState(48);
  const [county, setCounty] = useState("");
  const [exclusions, setExclusions] = useState<Record<ExclusionKey, boolean>>({
    has_criminal_conviction: false,
    has_unpaid_taxes: false,
    is_insolvent: false,
    has_professional_misconduct: false,
  });
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<CompanyVerification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [contractValue, setContractValue] = useState(10_000_000);
  const [requiredTurnover, setRequiredTurnover] = useState("");
  const [qualification, setQualification] = useState<QualificationScenarios | null>(null);
  const [qualLoading, setQualLoading] = useState(false);

  const handleQualification = async () => {
    if (!cui.trim()) {
      setError("Introduceți CUI-ul — analiza pornește de la datele reale ale firmei, nu de la cele completate manual.");
      return;
    }
    if (contractValue <= 0) {
      setError("Introduceți valoarea estimată a contractului.");
      return;
    }
    setQualLoading(true);
    setError(null);
    try {
      const parsed = requiredTurnover.trim() === "" ? undefined : Number(requiredTurnover);
      setQualification(
        await fetchQualificationScenarios({
          cui_fiscal: cui.trim(),
          estimated_value_ron: contractValue,
          required_turnover_ron: Number.isFinite(parsed as number) ? (parsed as number) : undefined,
          company_name: companyName.trim() || undefined,
        })
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Analiza traseelor de participare a eșuat.");
      setQualification(null);
    } finally {
      setQualLoading(false);
    }
  };

  /**
   * Pulls the company out of ANAF's own registers and fills the form from
   * it. Everything below the CUI used to be typed in and trusted — CAEN
   * code, county, turnover, headcount — which are exactly the four figures
   * the eligibility verdict is computed from, and the ones an applicant is
   * most likely to get wrong about themselves.
   */
  const handleVerify = async () => {
    if (!cui.trim()) {
      setError("Introduceți CUI-ul pentru a căuta firma în registrele oficiale.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const found = await verifyCompany(cui.trim(), companyName.trim() || undefined);
      setVerification(found);
      if (found.verified && found.company) {
        // The register is authoritative, so it overwrites the form rather
        // than only filling the blanks — seeing your own typed CAEN
        // replaced by the one ANAF has on file is the point of the button.
        if (found.company.company_name) setCompanyName(found.company.company_name);
        if (found.company.caen_code) setCaen(found.company.caen_code);
        if (found.company.county) setCounty(found.company.county);
        if (found.financials?.found) {
          if (typeof found.financials.turnover_ron === "number") setTurnover(found.financials.turnover_ron);
          if (typeof found.financials.employee_count === "number") setEmployees(found.financials.employee_count);
        }
        // ANAF declaring the taxpayer inactive is itself an Art. 165
        // exclusion ground, so it ticks the box rather than leaving the
        // user to self-declare something the state already published.
        if (found.company.is_inactive_taxpayer) {
          setExclusions((prev) => ({ ...prev, has_unpaid_taxes: true }));
        }
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Căutarea în registre nu a putut fi finalizată.");
      setVerification(null);
    } finally {
      setVerifying(false);
    }
  };

  // Prefills from the profile's own billing identity. Both are optional —
  // an individual monitoring the market has no CUI — so the fields stay
  // editable and simply start empty when unset.
  useEffect(() => {
    if (!profile) return;
    setCompanyName(profile.company_name || "");
    setCui(profile.cui || "");
    setCounty(profile.target_counties?.[0] || "");
  }, [profile]);

  const handleScan = async () => {
    if (!companyName.trim() || !cui.trim()) {
      setError("Completați denumirea companiei și CUI-ul.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(
        await evaluateBusinessEligibility({
          company_name: companyName,
          cui_fiscal: cui,
          caen_code: caen,
          turnover_ron: Number(turnover),
          employee_count: Number(employees),
          county,
          ...exclusions,
        })
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Scanarea nu a putut fi finalizată.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const flaggedCount = Object.values(exclusions).filter(Boolean).length;

  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-8">
      <PageHeader
        eyebrow="Eligibilitate finanțări"
        title="Verificarea profilului companiei"
        standfirst="Evaluează profilul financiar față de liniile de finanțare active și verifică motivele de excludere obligatorii din Legea 98/2016 înainte de a angaja resurse într-o procedură."
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="lg:col-span-5">
          <Panel className="p-4 sm:p-6">
            <Eyebrow className="mb-5 border-b border-divider pb-2">Profil companie</Eyebrow>
            <div className="space-y-5">
              <Field label="Denumire companie">
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" />
              </Field>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="CUI / cod fiscal">
                  <Input value={cui} onChange={(e) => setCui(e.target.value)} placeholder="RO12345678" />
                </Field>
                <Field label="Cod CAEN principal">
                  <Input value={caen} onChange={(e) => setCaen(e.target.value)} inputMode="numeric" />
                </Field>
                <Field label="Cifră de afaceri (RON)">
                  <NumberInput
                    min={0}
                    value={turnover}
                    onValueChange={setTurnover}
                  />
                </Field>
                <Field label="Număr angajați">
                  <NumberInput
                    min={0}
                    value={employees}
                    onValueChange={setEmployees}
                  />
                </Field>
              </div>
              <Field label="Județ sediu">
                <Input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="ex. Cluj" />
              </Field>
            </div>

            {/* The procurement question, distinct from the grant scoring
                below it: for a contract of THIS value, can this company
                bid alone — and if not, what does the law leave open. */}
            <div className="mt-6 border-t border-divider pt-5">
              <span className="flex items-center gap-1.5">
                <Eyebrow className="mb-2">Participare la o procedură</Eyebrow>
                <Explain k="qualificationRoutes" className="mb-2" />
              </span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Valoarea estimată a contractului (RON)">
                  <NumberInput
                    min={0}
                    value={contractValue}
                    onValueChange={setContractValue}
                  />
                </Field>
                <Field
                  label="Cifra de afaceri cerută (opțional)"
                  hint="Din fișa de date, dacă o cunoașteți."
                >
                  <Input
                    type="number" inputMode="numeric"
                    min={0}
                    value={requiredTurnover}
                    onChange={(e) => setRequiredTurnover(e.target.value)}
                    placeholder="ex. 20000000"
                  />
                </Field>
              </div>
              <Button onClick={handleQualification} variant="outline" fullWidth disabled={qualLoading} className="mt-4">
                {qualLoading ? "Se analizează…" : "Verifică traseele de participare"}
              </Button>
            </div>

            <div className="mt-5">
              <Button onClick={handleVerify} variant="outline" fullWidth disabled={verifying}>
                {verifying ? "Se caută în registre…" : "Caută firma în registrele oficiale (ANAF)"}
              </Button>
              <p className="font-body mt-2 text-xs leading-relaxed text-stock-500">
                Completează automat denumirea, codul CAEN, județul, cifra de afaceri și numărul de angajați din
                registrul ANAF și din bilanțul depus de firmă — în locul valorilor introduse manual.
              </p>
            </div>

            {verification && (
              <div className="mt-4">
                {verification.verified && verification.company ? (
                  <div className="neu-pressed rounded-2xl bg-paper p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="positive">Verificat ANAF</Badge>
                      {verification.company.vat_registered && <Badge tone="neutral">Plătitor TVA</Badge>}
                      {verification.company.is_inactive_taxpayer && <Badge tone="negative">Inactiv fiscal</Badge>}
                      {verification.financials?.found && (
                        <Badge tone="neutral">Bilanț {verification.financials.fiscal_year}</Badge>
                      )}
                    </div>
                    <p className="font-display mt-3 text-base font-semibold leading-snug">
                      {verification.company.company_name}
                    </p>
                    <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-[11px] text-stock-600 sm:grid-cols-2">
                      <div>Nr. reg. com.: {verification.company.trade_registry_number || "—"}</div>
                      <div>CAEN: {verification.company.caen_code || "—"}</div>
                      <div>Sediu: {verification.company.locality || verification.company.county || "—"}</div>
                      <div>Înregistrată: {verification.company.registration_date || "—"}</div>
                      {verification.financials?.found && (
                        <>
                          <div>
                            Cifră afaceri:{" "}
                            {typeof verification.financials.turnover_ron === "number"
                              ? formatRon(verification.financials.turnover_ron)
                              : "—"}
                          </div>
                          <div>Angajați: {verification.financials.employee_count ?? "—"}</div>
                        </>
                      )}
                    </dl>
                    {!verification.financials?.found && verification.financials?.error && (
                      <p className="font-body mt-2 text-xs leading-relaxed text-stock-500">
                        {verification.financials.error} Completați manual cifra de afaceri și numărul de angajați.
                      </p>
                    )}
                    {verification.registry_warnings?.map((w) => (
                      <div key={w} className="mt-3">
                        <Notice tone="warning">{w}</Notice>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Notice tone="alert" title="Firma nu a putut fi verificată">
                    {verification.error || "ANAF nu a returnat nicio firmă pentru acest CUI."}
                  </Notice>
                )}
              </div>
            )}

            <div className="mt-7 border-t border-divider pt-5">
              <Eyebrow className="text-editorial">Motive de excludere · Legea 98/2016</Eyebrow>
              <p className="font-body mt-1.5 text-xs leading-relaxed text-stock-600">
                Bifați orice situație aplicabilă. Oricare dintre acestea blochează participarea la procedură,
                indiferent de scorul financiar.
              </p>
              <div className="mt-3 divide-y divide-divider">
                {EXCLUSION_GROUNDS.map((g) => (
                  <Checkbox
                    key={g.key}
                    label={g.label}
                    checked={exclusions[g.key]}
                    onChange={(e) => setExclusions((prev) => ({ ...prev, [g.key]: e.target.checked }))}
                  />
                ))}
              </div>
              {flaggedCount > 0 && (
                <p className="font-mono mt-2 text-[11px] uppercase tracking-wider text-editorial">
                  {flaggedCount} motiv{flaggedCount > 1 ? "e" : ""} bifat{flaggedCount > 1 ? "e" : ""}
                </p>
              )}
            </div>

            {error && (
              <div className="mt-5">
                <Notice tone="alert">{error}</Notice>
              </div>
            )}

            <Button onClick={handleScan} disabled={loading} fullWidth className="mt-6">
              {loading ? "Se evaluează…" : "Evaluează profilul"}
            </Button>
          </Panel>
        </section>

        <section className="lg:col-span-7 space-y-6">
          {qualification && (
            <Panel className="p-4 sm:p-6">
              {!qualification.available ? (
                <Notice tone="alert" title="Compania nu a putut fi identificată">
                  {qualification.reason}
                </Notice>
              ) : (
                <>
                  <SectionTitle note={qualification.company?.name}>Trasee de participare</SectionTitle>

                  {/* Scenario A — can they lead. Status drives the tone, so
                      "blocked" and "eligible" are never mistakable. */}
                  {qualification.scenario_a_leader && (
                    <div
                      className={
                        "neu-pressed rounded-2xl bg-paper p-4 border-l-[3px] " +
                        (qualification.scenario_a_leader.status === "eligible"
                          ? "border-positive"
                          : qualification.scenario_a_leader.status === "blocked"
                            ? "border-negative"
                            : "border-warning")
                      }
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            qualification.scenario_a_leader.status === "eligible"
                              ? "positive"
                              : qualification.scenario_a_leader.status === "blocked"
                                ? "negative"
                                : "neutral"
                          }
                        >
                          {qualification.scenario_a_leader.label}
                        </Badge>
                        <span className="font-mono text-[11px] uppercase tracking-widest text-stock-500">
                          {qualification.scenario_a_leader.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      {qualification.scenario_a_leader.blockers.map((b, i) => (
                        <p key={i} className="font-body mt-2 text-sm font-medium leading-relaxed text-negative">
                          {b}
                        </p>
                      ))}
                      {qualification.scenario_a_leader.findings.map((f, i) => (
                        <p key={i} className="font-body mt-2 text-sm leading-relaxed text-stock-600">
                          {f}
                        </p>
                      ))}
                      {qualification.contract?.max_lawful_turnover_requirement_ron != null && (
                        <p className="font-mono mt-3 border-t border-divider pt-2 text-[11px] leading-relaxed text-stock-500">
                          Plafon legal maxim al cerinței de cifră de afaceri:{" "}
                          {formatRon(qualification.contract.max_lawful_turnover_requirement_ron)} —{" "}
                          {qualification.contract.ceiling_basis}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Scenario B — what the law leaves open. Shown always,
                      because "ineligible as leader" is not "ineligible". */}
                  {qualification.scenario_b_partnership && (
                    <div className="mt-5">
                      <span className="flex items-center gap-1.5">
                        <Eyebrow className="mb-2">{qualification.scenario_b_partnership.label}</Eyebrow>
                        <Explain k="partnershipRoutes" className="mb-2" />
                      </span>
                      {qualification.scenario_b_partnership.findings.map((f, i) => (
                        <p key={i} className="font-body mb-2 text-sm leading-relaxed text-stock-600">
                          {f}
                        </p>
                      ))}
                      <ul className="divide-y divide-divider">
                        {qualification.scenario_b_partnership.routes.map((r) => (
                          <li key={r.route} className="py-3">
                            <p className="font-body text-sm font-semibold">{r.label}</p>
                            <p className="font-body mt-1 text-sm leading-relaxed text-stock-600">{r.note}</p>
                            {r.legal_basis?.length > 0 && (
                              <p className="font-mono mt-1.5 text-[10px] text-stock-500">
                                {r.legal_basis.map((a) => a.citation).join(" · ")}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* The honest half: what was checked vs what cannot be. */}
                  {qualification.exclusion_review && (
                    <div className="mt-5 border-t border-divider pt-4">
                      <span className="flex items-center gap-1.5">
                        <Eyebrow className="mb-2">Motive de excludere</Eyebrow>
                        <Explain k="exclusionGrounds" className="mb-2" />
                      </span>
                      <ul className="divide-y divide-divider">
                        {qualification.exclusion_review.grounds.map((g) => (
                          <li key={g.ground} className="flex items-start gap-3 py-2.5">
                            <Badge
                              tone={
                                g.status === "pass" ? "positive" : g.status === "fail" ? "negative" : "neutral"
                              }
                            >
                              {g.status === "pass" ? "Verificat" : g.status === "fail" ? "Blocant" : "Neverificabil"}
                            </Badge>
                            <span className="min-w-0 flex-1">
                              <span className="font-body block text-sm">{g.ground}</span>
                              <span className="font-mono block text-[10px] leading-relaxed text-stock-500">
                                {g.detail} · {g.evidence_document}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="font-mono mt-3 text-[10px] leading-relaxed text-stock-500">
                        {qualification.exclusion_review.note}
                      </p>
                    </div>
                  )}

                  {qualification.recommendation && (
                    <div className="neu-pressed mt-5 rounded-r-lg border-l-2 border-editorial bg-editorial-soft px-4 py-3">
                      <Eyebrow className="text-editorial">Recomandare</Eyebrow>
                      <p className="font-body mt-1.5 text-sm leading-relaxed">{qualification.recommendation}</p>
                    </div>
                  )}
                  {qualification.method_note && (
                    <p className="font-mono mt-4 text-[10px] leading-relaxed text-stock-500">
                      {qualification.method_note}
                    </p>
                  )}
                </>
              )}
            </Panel>
          )}

          {loading ? (
            <Loading label="Se verifică criteriile de eligibilitate" />
          ) : !result ? (
            <div className="flex h-full min-h-[16rem] flex-col items-center justify-center neu-pressed rounded-3xl px-6 py-14 text-center">
              <Eyebrow className="text-stock-400">Rezultat</Eyebrow>
              <p className="font-display mt-3 max-w-sm text-xl font-semibold leading-snug">
                Completați profilul și lansați evaluarea
              </p>
              <p className="font-body mt-2 max-w-md text-sm leading-relaxed text-stock-600">
                Rezultatul include scorul de eligibilitate, liniile de finanțare potrivite și motivele de excludere
                identificate.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="neu-flat rounded-3xl bg-paper p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <Eyebrow className="text-editorial">Verdict</Eyebrow>
                    <p className="font-display mt-1 text-2xl font-semibold leading-tight">
                      {result.qualification_status || "Evaluare finalizată"}
                    </p>
                  </div>
                  {result.overall_eligibility_score != null && (
                    <p className="tabular font-display text-4xl font-semibold">
                      {result.overall_eligibility_score}
                      <span className="font-mono text-sm font-normal tracking-widest text-stock-500"> / 10</span>
                    </p>
                  )}
                </div>
                {result.advisory_summary && (
                  <p className="font-body mt-4 border-t border-divider pt-4 text-sm leading-relaxed text-stock-700">
                    {result.advisory_summary}
                  </p>
                )}
              </div>

              {result.company_profile && (
                <div className="scroll-x neu-pressed overflow-hidden rounded-2xl bg-paper">
                  <table className="w-full border-collapse text-left font-mono text-xs">
                    <tbody>
                      {[
                        ["Clasă mărime", result.company_profile.size_class?.replace(/_/g, " ")],
                        ["Statut IMM", result.company_profile.is_imm ? "Da" : "Nu"],
                        [
                          "Cifră de afaceri",
                          `${formatNumber(result.company_profile.turnover_ron)} RON · ${formatNumber(
                            Math.round(result.company_profile.turnover_eur)
                          )} EUR`,
                        ],
                        ["Regiune de dezvoltare", result.company_profile.development_region],
                        ["Curs valutar folosit", result.fx_rate_used ? `${result.fx_rate_used} RON/EUR` : undefined],
                      ]
                        .filter(([, v]) => v)
                        .map(([label, value]) => (
                          <tr key={label as string} className="border-b border-divider last:border-b-0">
                            <th
                              scope="row"
                              className="w-48 whitespace-nowrap border-r border-divider px-3 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500"
                            >
                              {label}
                            </th>
                            <td className="px-3 py-2.5 capitalize">{value}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              {Array.isArray(result.exclusion_grounds) && result.exclusion_grounds.length > 0 && (
                <section>
                  <SectionTitle note={`${result.exclusion_grounds.length} identificate`}>
                    Motive de excludere
                  </SectionTitle>
                  <ul className="divide-y divide-negative/20 neu-pressed overflow-hidden rounded-2xl border-l-[3px] border-negative bg-paper">
                    {result.exclusion_grounds.map((g, i) => (
                      <li key={i} className="font-body p-4 text-sm leading-relaxed font-medium text-negative">
                        {g}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {Array.isArray(result.matched_grants) && result.matched_grants.length > 0 && (
                <section>
                  <SectionTitle note={`${result.matched_grants.length} linii`}>Finanțări eligibile</SectionTitle>
                  <div className="divide-y divide-divider neu-flat overflow-hidden rounded-3xl bg-paper">
                    {result.matched_grants.map((g) => {
                      // A shallow CAEN match means the programme was reached
                      // by inference, not by a listed code. Presenting it
                      // beside an exact match without saying so would imply
                      // a certainty the data does not support.
                      const uncertain = g.caen_match && g.caen_match.depth !== "exact";
                      return (
                        <div key={g.program_id} className="p-4">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="font-display text-lg font-semibold leading-snug">{g.program_name}</h3>
                            <span className="font-display shrink-0 text-lg font-semibold">{g.eligible_grant_up_to}</span>
                          </div>

                          <div className="font-mono mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-wider text-stock-500">
                            <span>Cofinanțare: {g.required_co_financing}</span>
                            {g.estimated_own_contribution_ron != null && (
                              <span>Aport propriu: {formatRon(g.estimated_own_contribution_ron)}</span>
                            )}
                            {g.eligibility_score != null && <span>Scor: {g.eligibility_score}/10</span>}
                          </div>

                          {uncertain && (
                            <p className="neu-pressed font-body mt-3 rounded-r-md border-l-2 border-editorial bg-editorial-soft px-3 py-2 text-xs leading-relaxed text-editorial">
                              Potrivire CAEN incertă ({Math.round((g.caen_match?.confidence ?? 0) * 100)}%):{" "}
                              {g.caen_match?.note}
                            </p>
                          )}

                          <p className="font-mono mt-2 text-[11px] text-stock-400">{g.legal_basis}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <p className="font-mono text-[11px] leading-relaxed text-stock-500">
                Evaluare orientativă pe baza datelor introduse. Nu înlocuiește verificarea documentelor oficiale
                (certificat fiscal, cazier judiciar, situații financiare) cerute de autoritatea contractantă.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function EligibilityPage() {
  return (
    <AuthGate
      title="Scannerul de eligibilitate este pentru abonați"
      description="Evaluarea profilului companiei față de liniile de finanțare active necesită un cont."
    >
      <EligibilityContent />
    </AuthGate>
  );
}
