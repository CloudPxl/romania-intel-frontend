"use client";
import { useState } from "react";
import { useRightDrawer } from "@/context/CopilotContext";
import { X } from "lucide-react";
import { ApiError, addLeadToPipeline, type EligibilityGrant } from "@/lib/api";
import { formatRon } from "@/lib/format";
import { Badge, Button, Eyebrow } from "@/components/newsprint";

// Matches --duration-base in globals.css — same reasoning as
// LeadDossierPanel's identical constant: the exit keyframes run this
// long, and onClose (which unmounts this component) has to wait for them
// rather than cutting the animation off mid-slide.
const CLOSE_ANIMATION_MS = 320;

/**
 * The right-side slide-over for one matched grant under "Finanțări
 * eligibile" on /eligibility — same slide-in/slide-out mechanism as
 * LeadDossierPanel (Prima Pagina, /analysis, Căutare Avansată), so
 * opening a result reads the same way across the whole app. A grant has
 * no backend route of its own to re-fetch (the row already carries
 * everything the scan computed), so its one action is the one that
 * carries it forward: tracking the application in Pipeline ofertare.
 */
export default function GrantDetailPanel({ grant, onClose }: { grant: EligibilityGrant; onClose: () => void }) {
	useRightDrawer();
	const [closing, setClosing] = useState(false);
	const [saveState, setSaveState] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const handleSave = async () => {
		setSaving(true);
		try {
			const res = await addLeadToPipeline({
				source_id: `GRANT-${grant.program_id}`,
				project_title: grant.program_name,
				notes: [grant.eligible_grant_up_to && `Grant: ${grant.eligible_grant_up_to}`, grant.legal_basis].filter(Boolean).join(" · "),
			});
			setSaveState(
				res.status === "already_saved" ? "Programul este deja în pipeline." : res.status === "success" ? "Program salvat în pipeline." : res.message || "Nu s-a putut salva."
			);
		} catch (e) {
			setSaveState(e instanceof ApiError ? e.detail : "Nu s-a putut salva.");
		} finally {
			setSaving(false);
		}
	};
	const requestClose = () => {
		if (closing) return;
		setClosing(true);
		setTimeout(onClose, CLOSE_ANIMATION_MS);
	};

	const uncertain = grant.caen_match && grant.caen_match.depth !== "exact";

	return (
		<div className="fixed inset-0 z-50">
			<div
				className={"absolute inset-0 bg-ink/50 backdrop-blur-sm " + (closing ? "animate-[fade-out_var(--duration-base)_var(--ease-glide)_both]" : "animate-[fade-in_var(--duration-base)_var(--ease-glide)_both]")}
				onClick={requestClose}
				aria-hidden="true"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Linie de finanțare"
				className={"absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-paper " + (closing ? "animate-[slide-over-right-out_var(--duration-base)_var(--ease-glide)_both]" : "animate-[slide-over-right_var(--duration-base)_var(--ease-glide)_both]")}
			>
				<div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-divider bg-paper/95 p-4 backdrop-blur sm:p-6">
					<div className="min-w-0">
						<Eyebrow className="text-accent">Linie de finanțare · {grant.program_id}</Eyebrow>
						<h2 className="font-display mt-2 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{grant.program_name}</h2>
					</div>
					<button onClick={requestClose} aria-label="Închide" className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stock-500 transition-all duration-300 hover:neu-pressed-sm hover:text-ink">
						<X size={20} strokeWidth={1.5} />
					</button>
				</div>

				<div className="flex-1 p-4 sm:p-6">
					<div className="grid grid-cols-2 divide-x divide-divider neu-pressed overflow-hidden rounded-2xl bg-paper">
						<div className="p-4">
							<Eyebrow>Grant maxim</Eyebrow>
							<p className="tabular font-display mt-1 text-xl font-semibold leading-none">{grant.eligible_grant_up_to}</p>
						</div>
						<div className="p-4">
							<Eyebrow>Cofinanțare necesară</Eyebrow>
							<p className="font-display mt-1 text-xl font-semibold leading-none">{grant.required_co_financing}</p>
						</div>
					</div>

					<div className="scroll-x mt-5">
						<table className="w-full min-w-[26rem] neu-pressed overflow-hidden rounded-2xl bg-paper text-left font-mono text-xs">
							<tbody>
								{[
									["Aport propriu estimat", grant.estimated_own_contribution_ron != null ? formatRon(grant.estimated_own_contribution_ron) : "—"],
									["Scor eligibilitate", grant.eligibility_score != null ? `${grant.eligibility_score} / 10` : "—"],
									["Potrivire CAEN", grant.caen_match ? `${grant.caen_match.matched} · ${Math.round(grant.caen_match.confidence * 100)}%` : "—"],
									["Temei legal", grant.legal_basis || "—"],
								].map(([label, value]) => (
									<tr key={label} className="border-b border-divider last:border-b-0">
										<th scope="row" className="w-44 border-r border-divider px-3 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">
											{label}
										</th>
										<td className="px-3 py-2.5">{value}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{uncertain && grant.caen_match && (
						<div className="mt-5 rounded-xl border border-editorial-line bg-editorial-soft px-4 py-3">
							<div className="flex items-center gap-2">
								<Badge tone="neutral">Potrivire incertă · {grant.caen_match.depth}</Badge>
							</div>
							<p className="font-body mt-1.5 text-sm leading-relaxed">{grant.caen_match.note}</p>
						</div>
					)}

					{grant.action_required && (
						<div className="mt-5">
							<Eyebrow className="mb-1.5">Acțiune necesară</Eyebrow>
							<p className="font-body mt-2 text-sm leading-relaxed text-stock-600">{grant.action_required}</p>
						</div>
					)}

					<div className="mt-6">
						<Button onClick={handleSave} disabled={saving} fullWidth>
							{saving ? "Se salvează…" : "Urmărește aplicarea în Pipeline ofertare"}
						</Button>
						{saveState && <p className="font-body mt-2 text-xs text-stock-600">{saveState}</p>}
					</div>
				</div>
			</div>
		</div>
	);
}
