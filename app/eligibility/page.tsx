"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthGate from "@/components/AuthGate";
import Explain from "@/components/Explain";
import GrantDetailPanel from "@/components/GrantDetailPanel";
import { useCompanyProfile } from "@/context/CompanyProfileContext";
import { ApiError, evaluateBusinessEligibility, fetchQualificationScenarios, verifyCompany, type CompanyVerification, type EligibilityGrant, type QualificationScenarios, type EligibilityResult } from "@/lib/api";
import { formatNumber, formatRon } from "@/lib/format";
import { Badge, Button, Eyebrow, Field, Input, Loading, Notice, NumberInput, PageHeader, Panel, SectionTitle } from "@/components/newsprint";

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

// Shared Input/NumberInput's own default (min-h-[44px]) is a deliberate
// site-wide touch-target floor — overridden here, on this page only, via
// twMerge-aware className so these particular fields read as compact
// without changing that default anywhere else.
const COMPACT_FIELD = "min-h-9 py-1.5";

// Both action buttons read the same fixed color on this page regardless
// of variant ("Evaluează profilul" is primary/bg-editorial, "Verifică
// criteriile de participare" is outline/bg-paper by default) or theme —
// editorial itself differs between light and dark mode, and these two
// are meant to look identical in either.
const ACTION_BUTTON = "bg-[#006494] text-white hover:text-white";

function EligibilityContent() {
	const { profile } = useAuth();
	const company = useCompanyProfile();
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
	// Each action button gets its own error, shown directly above itself —
	// a shared error used to mean a failed "Verifică criteriile de
	// participare" click rendered under "Evaluează profilul" instead,
	// in the wrong card entirely.
	const [error, setError] = useState<string | null>(null);
	const [verification, setVerification] = useState<CompanyVerification | null>(null);
	const [verifying, setVerifying] = useState(false);
	const [contractValue, setContractValue] = useState(10_000_000);
	const [requiredTurnover, setRequiredTurnover] = useState("");
	const [qualification, setQualification] = useState<QualificationScenarios | null>(null);
	const [qualLoading, setQualLoading] = useState(false);
	const [qualError, setQualError] = useState<string | null>(null);
	// Opens the matching GrantDetailPanel in place, same slide-over-from-
	// the-right pattern as LeadDossierPanel elsewhere in the app.
	const [selectedGrant, setSelectedGrant] = useState<EligibilityGrant | null>(null);
	// Guards the CUI field's onBlur auto-lookup against re-firing for a CUI
	// it already looked up — e.g. tabbing through the field without typing,
	// or the blur that follows a manual "Caută firma" click on the same
	// value — without this every stray blur would re-hit ANAF.
	const lastLookedUpCuiRef = useRef<string>("");

	/**
	 * Overwrites the form with whatever a registry lookup just returned —
	 * shared by all three actions that can produce one (Verifică,
	 * Participare la o procedură, and Scanează, which runs its own lookup
	 * server-side by default). The register is authoritative, so this
	 * always overwrites rather than only filling blanks: seeing a typed
	 * CAEN or turnover replaced by ANAF's own figure is the point, not a
	 * one-time autofill that a scan with the box already full skips.
	 */
	const applyRegistryFields = (fields: { name?: string | null; caen?: string | null; county?: string | null; turnover?: number | null; employees?: number | null; isInactive?: boolean }) => {
		if (fields.name) setCompanyName(fields.name);
		if (fields.caen) setCaen(fields.caen);
		if (fields.county) setCounty(fields.county);
		if (typeof fields.turnover === "number") setTurnover(fields.turnover);
		if (typeof fields.employees === "number") setEmployees(fields.employees);
		// ANAF declaring the taxpayer inactive is itself an Art. 165 exclusion
		// ground, so it ticks the box rather than leaving the user to notice
		// something the state already published.
		if (fields.isInactive) setExclusions((prev) => ({ ...prev, has_unpaid_taxes: true }));
	};

	const handleQualification = async () => {
		if (!cui.trim()) {
			setQualError("Introduceți CUI-ul — analiza pornește de la datele reale ale firmei.");
			return;
		}
		if (contractValue <= 0) {
			setQualError("Introduceți valoarea estimată a contractului.");
			return;
		}
		setQualLoading(true);
		setQualError(null);
		try {
			const parsed = requiredTurnover.trim() === "" ? undefined : Number(requiredTurnover);
			const qual = await fetchQualificationScenarios({
				cui_fiscal: cui.trim(),
				estimated_value_ron: contractValue,
				required_turnover_ron: Number.isFinite(parsed as number) ? (parsed as number) : undefined,
				company_name: companyName.trim() || undefined,
			});
			setQualification(qual);
			// This route also verifies the CUI against ANAF server-side — reuse
			// that lookup to fill the form instead of requiring a separate
			// Verifică click first.
			if (qual.available && qual.company) {
				applyRegistryFields({
					name: qual.company.name,
					caen: qual.company.caen_code,
					county: qual.company.county,
					turnover: qual.company.turnover_ron,
					employees: qual.company.employee_count,
					isInactive: qual.company.is_inactive_taxpayer,
				});
			}
		} catch (e) {
			setQualError(e instanceof ApiError ? e.detail : "Analiza criteriilor de participare a eșuat.");
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
	 *
	 * Deliberately does NOT pass the current companyName as the declared
	 * name to compare against the registry's answer. This only ever runs
	 * from the CUI field's own onBlur now (the manual "Verifică" button is
	 * gone), so companyName at call time is whatever the *previous* lookup
	 * filled in — checking a second company after a first one leaves the
	 * first company's name sitting in the field until this very call
	 * overwrites it, which produced a "DAS SRL ≠ CONEST SA" mismatch
	 * warning against a name the user never typed for this CUI at all.
	 */
	const handleVerify = async () => {
		const trimmedCui = cui.trim();
		if (!trimmedCui) {
			setError("Introduceți CUI-ul pentru a căuta firma în registrele oficiale.");
			return;
		}
		lastLookedUpCuiRef.current = trimmedCui;
		setVerifying(true);
		setError(null);
		try {
			const found = await verifyCompany(trimmedCui);
			setVerification(found);
			if (found.verified && found.company) {
				// The registry identity becomes the workspace's: Redactare
				// fills its document headers from it without asking again.
				company.save({
					cui: String(found.company.cui ?? trimmedCui),
					company_name: found.company.company_name,
					registration_number: found.company.trade_registry_number,
					address: found.company.address || [found.company.locality, found.company.county].filter(Boolean).join(", ") || null,
					caen_code: found.company.caen_code,
				});
				applyRegistryFields({
					name: found.company.company_name,
					caen: found.company.caen_code,
					county: found.company.county,
					turnover: found.financials?.found ? found.financials.turnover_ron : undefined,
					employees: found.financials?.found ? found.financials.employee_count : undefined,
					isInactive: found.company.is_inactive_taxpayer,
				});
			}
		} catch (e) {
			setError(e instanceof ApiError ? e.detail : "Căutarea în registre nu a putut fi finalizată.");
			setVerification(null);
		} finally {
			setVerifying(false);
		}
	};

	// Looks the company up the moment the user leaves the CUI field, rather
	// than making "Caută firma în registrele oficiale" a separate step
	// they have to remember to click. Skips a CUI already looked up (see
	// lastLookedUpCuiRef) and one already mid-lookup from the manual
	// button, and never blocks on a blank field — blur fires on every tab
	// press, including out of an empty, untouched form.
	const handleCuiBlur = () => {
		const trimmedCui = cui.trim();
		if (!trimmedCui || trimmedCui === lastLookedUpCuiRef.current || verifying) return;
		handleVerify();
	};

	// Prefills from the profile's own billing identity. Both are optional —
	// an individual monitoring the market has no CUI — so the fields stay
	// editable and simply start empty when unset.
	useEffect(() => {
		if (!profile) return;
		setCompanyName(company.profile?.company_name || profile.company_name || "");
		setCui(company.profile?.cui || profile.cui || "");
		if (company.profile?.caen_code) setCaen(company.profile.caen_code);
		setCounty(profile.target_counties?.[0] || "");
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [profile]);

	const handleScan = async () => {
		if (!companyName.trim() || !cui.trim()) {
			setError("Completați CUI-ul companiei.");
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const scan = await evaluateBusinessEligibility({
				company_name: companyName,
				cui_fiscal: cui,
				caen_code: caen,
				turnover_ron: Number(turnover),
				employee_count: Number(employees),
				county,
				...exclusions,
			});
			setResult(scan);
			// Scanează runs its own ANAF lookup server-side by default
			// (verify_with_registry), so if it found the company, sync the form
			// to what the registry actually says rather than leaving it to show
			// whatever was typed (or left blank) before the scan.
			const reg = scan.registry_verification;
			if (reg?.verified && reg.company) {
				applyRegistryFields({
					name: reg.company.company_name,
					caen: reg.company.caen_code,
					county: reg.company.county,
					turnover: reg.financials?.found ? reg.financials.turnover_ron : undefined,
					employees: reg.financials?.found ? reg.financials.employee_count : undefined,
					isInactive: reg.company.is_inactive_taxpayer,
				});
			}
		} catch (e) {
			setError(e instanceof ApiError ? e.detail : "Scanarea nu a putut fi finalizată.");
			setResult(null);
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-8">
			<PageHeader
				eyebrow="Eligibilitate finanțări"
				title="Verificarea profilului companiei"
				standfirst="Evaluează profilul financiar față de liniile de finanțare active și verifică motivele de excludere obligatorii din Legea 98/2016 înainte de a angaja resurse într-o procedură. Verificarea se face la nivel de linie de finanțare (program), nu la nivel de apel sau proiect individual — pentru oportunități concrete, consultați Analiza de piață sau Căutarea avansată."
			/>

			{/* Three cards in one row, same convention as /analysis's filter
          cards — each a self-contained step rather than one long form,
          since the three actions below them (Evaluează profilul, Verifică
          criteriile de participare) run independently of each other. */}
			<div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
				<Panel className="p-4 sm:p-5">
					<Eyebrow className="mb-5 border-b border-divider pb-2">Profil companie</Eyebrow>
					<div className="space-y-4">
						<Field label="Denumire companie">
							<Input className={COMPACT_FIELD} value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" />
						</Field>
						<div className="grid grid-cols-2 gap-4">
							<Field label="CUI / cod fiscal">
								<Input className={COMPACT_FIELD} value={cui} onChange={(e) => setCui(e.target.value)} onBlur={handleCuiBlur} placeholder="RO12345678" />
							</Field>
							<Field label="Cod CAEN principal">
								<Input className={COMPACT_FIELD} value={caen} onChange={(e) => setCaen(e.target.value)} inputMode="numeric" />
							</Field>
						</div>
						<Field label="Cifră de afaceri (RON)">
							<NumberInput className={COMPACT_FIELD} min={0} value={turnover} onValueChange={setTurnover} />
						</Field>
						<div className="grid grid-cols-2 gap-4">
							<Field label="Număr angajați">
								<NumberInput className={COMPACT_FIELD} min={0} value={employees} onValueChange={setEmployees} />
							</Field>
							<Field label="Județ sediu">
								<Input className={COMPACT_FIELD} value={county} onChange={(e) => setCounty(e.target.value)} placeholder="ex. Cluj" />
							</Field>
						</div>
					</div>

					{/* Feedback from the CUI field's own onBlur lookup (or
              whichever of the three actions last ran one) — confirms the
              fields above came from ANAF, not just what was typed. */}
					{verification && (
						<div className="mt-5">
							{verification.verified && verification.company ? (
								<div className="neu-pressed rounded-2xl bg-paper p-4">
									<div className="flex flex-wrap items-center gap-2">
										<Badge tone="positive">Verificat ANAF</Badge>
										{verification.company.vat_registered && <Badge tone="neutral">Plătitor TVA</Badge>}
										{verification.company.is_inactive_taxpayer && <Badge tone="negative">Inactiv fiscal</Badge>}
										{verification.financials?.found && <Badge tone="neutral">Bilanț {verification.financials.fiscal_year}</Badge>}
									</div>
									<p className="font-display mt-3 text-base font-semibold leading-snug">{verification.company.company_name}</p>
									<dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-[11px] text-stock-600 sm:grid-cols-2">
										<div>Nr. reg. com.: {verification.company.trade_registry_number || "—"}</div>
										<div>CAEN: {verification.company.caen_code || "—"}</div>
										<div>Sediu: {verification.company.locality || verification.company.county || "—"}</div>
										<div>Înregistrată: {verification.company.registration_date || "—"}</div>
										{verification.financials?.found && (
											<>
												<div>Cifră afaceri: {typeof verification.financials.turnover_ron === "number" ? formatRon(verification.financials.turnover_ron) : "—"}</div>
												<div>Angajați: {verification.financials.employee_count ?? "—"}</div>
											</>
										)}
									</dl>
									{!verification.financials?.found && verification.financials?.error && <p className="font-body mt-2 text-xs leading-relaxed text-stock-500">{verification.financials.error} Completați manual cifra de afaceri și numărul de angajați.</p>}
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

					{error && (
						<div className="mt-5">
							<Notice tone="alert">{error}</Notice>
						</div>
					)}
					<Button onClick={handleScan} disabled={loading} fullWidth className={`mt-6 ${ACTION_BUTTON}`}>
						{loading ? "Se evaluează…" : "Evaluează profilul"}
					</Button>
				</Panel>

				{/* The procurement question, distinct from the grant scoring
            card beside it: for a contract of THIS value, can this
            company bid alone — and if not, what does the law leave open. */}
				<Panel className="p-4 sm:p-5">
					<Eyebrow className="mb-5 border-b border-divider pb-2">
						Participare la o procedură
						<Explain k="qualificationRoutes" />
					</Eyebrow>
					<div className="space-y-4">
						<Field label="Valoarea estimată a contractului (RON)">
							<NumberInput className={COMPACT_FIELD} min={0} value={contractValue} onValueChange={setContractValue} />
						</Field>
						<Field label="Cifra de afaceri cerută (opțional)" hint="Din fișa de date, dacă o cunoașteți.">
							<Input className={COMPACT_FIELD} type="number" inputMode="numeric" min={0} value={requiredTurnover} onChange={(e) => setRequiredTurnover(e.target.value)} placeholder="ex. 20000000" />
						</Field>
					</div>
					{qualError && (
						<div className="mt-5">
							<Notice tone="alert">{qualError}</Notice>
						</div>
					)}
					<Button onClick={handleQualification} fullWidth disabled={qualLoading} className={`mt-6 ${ACTION_BUTTON}`}>
						{qualLoading ? "Se analizează…" : "Verifică criteriile de participare"}
					</Button>
				</Panel>

				<Panel className="p-4 sm:p-5">
					<Eyebrow className="mb-5 border-b border-divider pb-2">Motive de excludere · Legea 98/2016</Eyebrow>
					{/* Informative only, deliberately not checkboxes: niciunul dintre
              aceste patru motive nu poate fi verificat dintr-un API
              public (cazier judiciar, certificat fiscal, insolvență,
              abatere profesională nu au o sursă liberă de consultat), iar
              o evaluare construită pe o bifă auto-declarată ar fi o
              certificare fără valoare reală. Singurul semnal real pe care
              îl avem — contribuabil inactiv la ANAF — vine automat din
              verificarea CUI-ului, nu dintr-o bifă. */}
					<p className="font-body text-xs leading-relaxed text-stock-600">
						Niciunul dintre aceste motive nu poate fi verificat automat dintr-un registru public — sunt prezentate informativ, nu ca opțiuni de bifat. Oricare dintre ele blochează participarea la procedură, indiferent de scorul financiar, și se dovedește cu documentul oficial
						corespunzător înainte de atribuire.
					</p>
					<ul className="mt-3 divide-y divide-divider">
						{EXCLUSION_GROUNDS.map((g) => (
							<li key={g.key} className="font-body py-2.5 text-sm text-stock-700">
								{g.label}
							</li>
						))}
					</ul>
					{exclusions.has_unpaid_taxes && <p className="font-mono mt-2 text-[11px] uppercase tracking-wider text-editorial">Semnalat automat: ANAF declară firma inactivă fiscal (Art. 165).</p>}
				</Panel>
			</div>

			<div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
				<section className="space-y-6">
					{loading ? (
						<Loading label="Se verifică criteriile de eligibilitate" />
					) : !result ? (
						<div className="flex h-full min-h-[16rem] flex-col items-center justify-center neu-pressed rounded-3xl px-6 py-14 text-center">
							<Eyebrow className="text-stock-400">Rezultat</Eyebrow>
							<p className="font-display mt-3 max-w-sm text-xl font-semibold leading-snug">Completați profilul și lansați evaluarea</p>
							<p className="font-body mt-2 max-w-md text-sm leading-relaxed text-stock-600">Rezultatul include scorul de eligibilitate, liniile de finanțare potrivite și motivele de excludere identificate.</p>
						</div>
					) : (
						<div className="space-y-6">
							<div className="neu-flat rounded-3xl bg-paper p-5">
								<div className="flex flex-wrap items-baseline justify-between gap-3">
									<div>
										<Eyebrow className="text-editorial">Verdict</Eyebrow>
										<p className="font-display mt-1 text-2xl font-semibold leading-tight">{result.qualification_status || "Evaluare finalizată"}</p>
									</div>
									{result.overall_eligibility_score != null && (
										<p className="tabular font-display text-4xl font-semibold">
											{result.overall_eligibility_score}
											<span className="font-mono text-sm font-normal tracking-widest text-stock-500"> / 10</span>
										</p>
									)}
								</div>
								{result.advisory_summary && <p className="font-body mt-4 border-t border-divider pt-4 text-sm leading-relaxed text-stock-700">{result.advisory_summary}</p>}
							</div>

							{result.company_profile && (
								<div className="scroll-x neu-pressed overflow-hidden rounded-2xl bg-paper">
									<table className="w-full border-collapse text-left font-mono text-xs">
										<tbody>
											{[
												["Clasă mărime", result.company_profile.size_class?.replace(/_/g, " ")],
												["Statut IMM", result.company_profile.is_imm ? "Da" : "Nu"],
												["Cifră de afaceri", `${formatNumber(result.company_profile.turnover_ron)} RON · ${formatNumber(Math.round(result.company_profile.turnover_eur))} EUR`],
												["Regiune de dezvoltare", result.company_profile.development_region],
												["Curs valutar folosit", result.fx_rate_used ? `${result.fx_rate_used} RON/EUR` : undefined],
											]
												.filter(([, v]) => v)
												.map(([label, value]) => (
													<tr key={label as string} className="border-b border-divider last:border-b-0">
														<th scope="row" className="w-48 whitespace-nowrap border-r border-divider px-3 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">
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
									<SectionTitle note={`${result.exclusion_grounds.length} identificate`}>Motive de excludere</SectionTitle>
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
												<button key={g.program_id} type="button" onClick={() => setSelectedGrant(g)} className="group w-full p-4 text-left transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:neu-pressed-sm active:scale-[0.99]">
													<div className="flex flex-wrap items-baseline justify-between gap-2">
														<h3 className="font-display flex items-center gap-1.5 text-lg font-semibold leading-snug">
															<span>{g.program_name}</span>
															<span aria-hidden="true" className="shrink-0 text-editorial opacity-0 transition-all duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:opacity-100">
																→
															</span>
														</h3>
														<span className="font-display shrink-0 text-lg font-semibold">{g.eligible_grant_up_to}</span>
													</div>

													<div className="font-mono mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-wider text-stock-500">
														<span>Cofinanțare: {g.required_co_financing}</span>
														{g.estimated_own_contribution_ron != null && <span>Aport propriu: {formatRon(g.estimated_own_contribution_ron)}</span>}
														{g.eligibility_score != null && <span>Scor: {g.eligibility_score}/10</span>}
													</div>

													{uncertain && (
														<p className="neu-pressed font-body mt-3 rounded-r-md border-l-2 border-editorial bg-editorial-soft px-3 py-2 text-xs leading-relaxed text-editorial">
															Potrivire CAEN incertă ({Math.round((g.caen_match?.confidence ?? 0) * 100)}%): {g.caen_match?.note}
														</p>
													)}

													<p className="font-mono mt-2 text-[11px] text-stock-400">{g.legal_basis}</p>
												</button>
											);
										})}
									</div>
								</section>
							)}

							<p className="font-mono text-[11px] leading-relaxed text-stock-500">Evaluare orientativă pe baza datelor introduse. Nu înlocuiește verificarea documentelor oficiale (certificat fiscal, cazier judiciar, situații financiare) cerute de autoritatea contractantă.</p>
						</div>
					)}
				</section>

				<section className="space-y-6">
					{qualLoading ? (
						<Loading label="Se verifică criteriile de participare" />
					) : !qualification ? (
						<div className="flex h-full min-h-[16rem] flex-col items-center justify-center neu-pressed rounded-3xl px-6 py-14 text-center">
							<Eyebrow className="text-stock-400">Criterii de participare</Eyebrow>
							<p className="font-display mt-3 max-w-sm text-xl font-semibold leading-snug">Completați contractul și lansați verificarea</p>
							<p className="font-body mt-2 max-w-md text-sm leading-relaxed text-stock-600">Rezultatul include criteriile de participare disponibile (ofertant individual, asociere, subcontractare) pentru valoarea contractului introdusă.</p>
						</div>
					) : (
						<Panel className="p-4 sm:p-6">
							{!qualification.available ? (
								<Notice tone="alert" title="Compania nu a putut fi identificată">
									{qualification.reason}
								</Notice>
							) : (
								<>
									<SectionTitle note={qualification.company?.name}>Criterii de participare</SectionTitle>

									{/* Scenario A — can they lead. Status drives the tone, so
                      "blocked" and "eligible" are never mistakable. */}
									{qualification.scenario_a_leader && (
										<div className={"neu-pressed rounded-2xl bg-paper p-4 border-l-[3px] " + (qualification.scenario_a_leader.status === "eligible" ? "border-positive" : qualification.scenario_a_leader.status === "blocked" ? "border-negative" : "border-warning")}>
											<div className="flex flex-wrap items-center gap-2">
												<Badge tone={qualification.scenario_a_leader.status === "eligible" ? "positive" : qualification.scenario_a_leader.status === "blocked" ? "negative" : "neutral"}>{qualification.scenario_a_leader.label}</Badge>
												<span className="font-mono text-[11px] uppercase tracking-widest text-stock-500">{qualification.scenario_a_leader.status.replace(/_/g, " ")}</span>
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
													Plafon legal maxim al cerinței de cifră de afaceri: {formatRon(qualification.contract.max_lawful_turnover_requirement_ron)} — {qualification.contract.ceiling_basis}
												</p>
											)}
										</div>
									)}

									{/* Scenario B — what the law leaves open. Shown always,
                      because "ineligible as leader" is not "ineligible". */}
									{qualification.scenario_b_partnership && (
										<div className="mt-5">
											<Eyebrow className="mb-2 flex h-[13px] items-center gap-1.5">
												{qualification.scenario_b_partnership.label}
												<Explain k="partnershipRoutes" />
											</Eyebrow>
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
														{r.legal_basis?.length > 0 && <p className="font-mono mt-1.5 text-[10px] text-stock-500">{r.legal_basis.map((a) => a.citation).join(" · ")}</p>}
													</li>
												))}
											</ul>
										</div>
									)}

									{qualification.recommendation && (
										<div className="neu-pressed mt-5 rounded-r-lg border-l-2 border-editorial bg-editorial-soft px-4 py-3">
											<Eyebrow className="text-editorial">Recomandare</Eyebrow>
											<p className="font-body mt-1.5 text-sm leading-relaxed">{qualification.recommendation}</p>
										</div>
									)}
									{qualification.method_note && <p className="font-mono mt-4 text-[10px] leading-relaxed text-stock-500">{qualification.method_note}</p>}
								</>
							)}
						</Panel>
					)}
				</section>
			</div>

			{selectedGrant && <GrantDetailPanel grant={selectedGrant} onClose={() => setSelectedGrant(null)} />}
		</main>
	);
}

export default function EligibilityPage() {
	return (
		<AuthGate title="Scannerul de eligibilitate este pentru abonați" description="Evaluarea profilului companiei față de liniile de finanțare active necesită un cont.">
			<EligibilityContent />
		</AuthGate>
	);
}
