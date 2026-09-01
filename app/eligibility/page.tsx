"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthGate from "@/components/AuthGate";
import { ApiError, evaluateBusinessEligibility, type EligibilityResult } from "@/lib/api";
import { formatNumber, formatRon } from "@/lib/format";
import {
  Button,
  Checkbox,
  Eyebrow,
  Field,
  Input,
  Loading,
  Notice,
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
  const { activeDesk } = useAuth();
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

  useEffect(() => {
    if (!activeDesk) return;
    setCompanyName(activeDesk.name);
    setCui(activeDesk.cui || "");
    setCounty(activeDesk.target_counties?.[0] || "");
  }, [activeDesk]);

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
                  <Input
                    type="number"
                    min={0}
                    value={turnover}
                    onChange={(e) => setTurnover(Number(e.target.value))}
                  />
                </Field>
                <Field label="Număr angajați">
                  <Input
                    type="number"
                    min={0}
                    value={employees}
                    onChange={(e) => setEmployees(Number(e.target.value))}
                  />
                </Field>
              </div>
              <Field label="Județ sediu">
                <Input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="ex. Cluj" />
              </Field>
            </div>

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

        <section className="lg:col-span-7">
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
