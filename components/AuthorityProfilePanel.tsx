"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ApiError, fetchAuthorityProfile, type AuthorityProfile } from "@/lib/api";
import { formatDate, formatRon } from "@/lib/format";
import { Badge, Eyebrow, Loading, Notice } from "@/components/newsprint";

const CLOSE_ANIMATION_MS = 320;

/**
 * Who this contracting authority actually awards to, from real SEAP award
 * notices: total value, how concentrated its suppliers are (HHI), how often
 * a contract went to what was most likely a single offer, and the top
 * winners by CUI. Opened in place from any authority name — a name in a list
 * is a question the reader has, not a label.
 */
export default function AuthorityProfilePanel({
  cui,
  name,
  onClose,
}: {
  cui?: string | null;
  name?: string | null;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<AuthorityProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, CLOSE_ANIMATION_MS);
  };

  useEffect(() => {
    let mounted = true;
    fetchAuthorityProfile({ cui, name })
      .then((p) => mounted && setProfile(p))
      .catch((e) => mounted && setError(e instanceof ApiError ? e.detail : "Profilul autorității nu a putut fi încărcat."));
    return () => {
      mounted = false;
    };
  }, [cui, name]);

  const conc = profile?.concentration;
  const title = profile?.authority_name || name || "Autoritate contractantă";

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={
          "absolute inset-0 bg-ink/50 backdrop-blur-sm " +
          (closing
            ? "animate-[fade-out_var(--duration-base)_var(--ease-glide)_both]"
            : "animate-[fade-in_var(--duration-base)_var(--ease-glide)_both]")
        }
        onClick={requestClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Profilul autorității ${title}`}
        className={
          "absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto bg-paper " +
          (closing
            ? "animate-[slide-over-right-out_var(--duration-base)_var(--ease-glide)_both]"
            : "animate-[slide-over-right_var(--duration-base)_var(--ease-glide)_both]")
        }
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-divider bg-paper/95 p-4 backdrop-blur sm:p-6">
          <div className="min-w-0">
            <Eyebrow className="text-accent">
              Profil autoritate{profile?.authority_cui ? ` · CUI ${profile.authority_cui}` : ""}
            </Eyebrow>
            <h2 className="font-display mt-2 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{title}</h2>
            <p className="font-mono mt-1 text-[11px] uppercase tracking-widest text-stock-500">
              Atribuiri reale SEAP · ultimele {profile?.window_months ?? 36} de luni
            </p>
          </div>
          <button
            onClick={requestClose}
            aria-label="Închide profilul"
            className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stock-500 transition-all duration-300 hover:neu-pressed-sm hover:text-ink"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 space-y-6 p-4 sm:p-6">
          {error ? (
            <Notice tone="alert">{error}</Notice>
          ) : !profile ? (
            <Loading label="Se încarcă atribuirile autorității" />
          ) : !conc?.available ? (
            <Notice tone="warning" title="Date insuficiente">
              {profile.reason ||
                `Am găsit ${conc?.awards ?? 0} atribuiri pentru această autoritate — prea puține pentru indicatori de concentrare.`}
            </Notice>
          ) : (
            <>
              <div className="rule-grid grid grid-cols-2">
                <div className="p-4">
                  <Eyebrow>Valoare atribuită</Eyebrow>
                  <p className="tabular font-display mt-1.5 text-xl font-semibold leading-none">{formatRon(conc.total_awarded_ron)}</p>
                  <p className="font-mono mt-1 text-[10px] text-stock-500">{conc.awards} contracte</p>
                </div>
                <div className="p-4">
                  <Eyebrow>Concentrare (HHI)</Eyebrow>
                  <p className="tabular font-display mt-1.5 text-xl font-semibold leading-none">{conc.hhi?.toLocaleString("ro-RO")}</p>
                  <p className="font-mono mt-1 text-[10px] text-stock-500">{conc.hhi_label}</p>
                </div>
                <div className="p-4">
                  <Eyebrow>Cel mai mare câștigător</Eyebrow>
                  <p className="tabular font-display mt-1.5 text-xl font-semibold leading-none">{conc.top_winner_share_pct}%</p>
                  <p className="font-mono mt-1 text-[10px] text-stock-500">din valoare · {conc.distinct_winners} câștigători distincți</p>
                </div>
                <div className="p-4">
                  <Eyebrow>Ofertă unică (probabil)</Eyebrow>
                  <p className="tabular font-display mt-1.5 text-xl font-semibold leading-none">
                    {profile.single_offer.rate_pct != null ? `${profile.single_offer.rate_pct}%` : "—"}
                  </p>
                  <p className="font-mono mt-1 text-[10px] text-stock-500">din {profile.single_offer.sample_size} contracte cu oferte publicate</p>
                </div>
              </div>
              <p className="font-mono text-[10px] leading-relaxed text-stock-500">
                {conc.hhi_note} {profile.single_offer.note}
              </p>

              <section>
                <Eyebrow className="mb-2">Câștigători principali</Eyebrow>
                <ul className="divide-y divide-divider">
                  {conc.top_winners?.map((w) => (
                    <li key={w.cui || w.name} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="font-body block truncate text-sm">{w.name}</span>
                        {w.cui && <span className="font-mono text-[10px] text-stock-500">CUI {w.cui}</span>}
                      </span>
                      <span className="tabular font-mono shrink-0 text-xs text-stock-600">
                        {formatRon(w.value_ron)} · {w.share_pct}% · {w.awards} contr.
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {profile.discount.available && profile.discount.ratio_pct && (
                <section>
                  <Eyebrow className="mb-2">Preț atribuit / valoare estimată la această autoritate</Eyebrow>
                  <p className="font-body text-sm leading-relaxed text-stock-600">
                    Median {profile.discount.ratio_pct.p50.toFixed(1)}% (P25 {profile.discount.ratio_pct.p25.toFixed(1)}% — P75{" "}
                    {profile.discount.ratio_pct.p75.toFixed(1)}%), din {profile.discount.sample_size} contracte.
                  </p>
                </section>
              )}

              {profile.competition_factor && (
                <div className="neu-pressed rounded-2xl bg-paper px-4 py-3">
                  <Eyebrow className="text-accent">Factor de concurență în pipeline</Eyebrow>
                  <p className="font-body mt-1 text-sm">
                    φ = {profile.competition_factor.phi} — {profile.competition_factor.basis}.
                  </p>
                </div>
              )}
            </>
          )}

          {profile?.recent_awards?.length ? (
            <section>
              <Eyebrow className="mb-2">Atribuiri recente</Eyebrow>
              <ul className="divide-y divide-divider">
                {profile.recent_awards.map((a, i) => (
                  <li key={i} className="py-2.5">
                    <a
                      href={a.source_url || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body block text-sm font-medium transition-colors hover:text-accent"
                    >
                      {a.title || "Contract fără titlu"}
                    </a>
                    <p className="font-mono mt-0.5 text-[11px] text-stock-500">
                      {a.published_at ? formatDate(a.published_at) : "—"} · {a.winner_name || "câștigător nepublicat"} ·{" "}
                      {formatRon(a.awarded_value_ron ?? 0)}
                      {a.procedure_type && <Badge tone="neutral" className="ml-2">{a.procedure_type}</Badge>}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
