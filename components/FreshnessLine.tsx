"use client";
import { useEffect, useState } from "react";
import { fetchDataFreshness, type DataFreshness } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * How current the data behind every page is: when the tender register last
 * moved and when the statutory texts were last checked against
 * legislatie.just.ro. A bidder deciding on a deadline or a threshold should
 * not have to trust that "live" means live.
 *
 * One request per five minutes, shared by every component on the page;
 * nothing renders until it has answered, and nothing at all if the API is
 * unreachable — a missing line is better than a wrong one.
 */
const REFRESH_MS = 5 * 60 * 1000;
const TENDERS_STALE_AFTER_MIN = 120;
const LEGAL_STALE_AFTER_DAYS = 8;

let shared: { data: DataFreshness | null; at: number; inflight: Promise<DataFreshness | null> | null } = {
  data: null,
  at: 0,
  inflight: null,
};

function load(): Promise<DataFreshness | null> {
  if (shared.data && Date.now() - shared.at < REFRESH_MS) return Promise.resolve(shared.data);
  if (!shared.inflight) {
    shared.inflight = fetchDataFreshness()
      .then((d) => {
        shared = { data: d, at: Date.now(), inflight: null };
        return d;
      })
      .catch(() => {
        shared.inflight = null;
        return shared.data;
      });
  }
  return shared.inflight;
}

function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60000)) : null;
}

export function ago(minutes: number): string {
  if (minutes < 1) return "acum";
  if (minutes < 60) return `acum ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `acum ${hours} h`;
  return `acum ${Math.round(hours / 24)} zile`;
}

function numericDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export interface FreshnessState {
  tendersMin: number | null;
  tendersStale: boolean;
  legalLabel: string;
  legalDate: string | null;
  legalStale: boolean;
}

export function useFreshness(): FreshnessState | null {
  const [data, setData] = useState<DataFreshness | null>(shared.data);
  useEffect(() => {
    let mounted = true;
    const tick = () => load().then((d) => mounted && d && setData(d));
    tick();
    const timer = setInterval(tick, REFRESH_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);
  if (!data) return null;
  const tendersMin = minutesSince(data.datasets.tenders?.last_synced_at);
  const legalMin = minutesSince(data.legal.checked_at);
  return {
    tendersMin,
    tendersStale: tendersMin === null || tendersMin > TENDERS_STALE_AFTER_MIN,
    legalLabel:
      data.legal.thresholds_match === false
        ? "Legislație: praguri de reverificat"
        : data.legal.synced && data.legal.checked_at
          ? "Legislație verificată"
          : "Legislație: verificare în curs",
    legalDate: data.legal.checked_at ? numericDate(data.legal.checked_at) : null,
    legalStale:
      !data.legal.synced || legalMin === null || legalMin > LEGAL_STALE_AFTER_DAYS * 1440 || data.legal.thresholds_match === false,
  };
}

const Dot = ({ warn }: { warn: boolean }) => (
  <span
    aria-hidden
    className={cn(
      "inline-block h-[7px] w-[7px] shrink-0 rounded-full",
      warn ? "bg-warning shadow-[0_0_0_3px_var(--color-warning-soft)]" : "bg-positive shadow-[0_0_0_3px_var(--color-positive-soft)]"
    )}
  />
);

function SourceRow({ label, iso, rows, note, warn, verb = "colectare" }: { label: string; iso: string | null | undefined; rows?: number; note?: string; warn: boolean; verb?: string }) {
  const min = minutesSince(iso);
  return (
    <li className="flex items-start gap-2.5 py-2">
      <span className="mt-[7px]"><Dot warn={warn} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        <span className="tabular block text-[12px] text-stock-500">
          {min === null ? `Nicio ${verb} reușită înregistrată` : `Ultima ${verb} reușită ${ago(min)}`}
          {typeof rows === "number" && rows > 0 ? ` · ${new Intl.NumberFormat("ro-RO", { useGrouping: "always" } as Intl.NumberFormatOptions).format(rows)} înregistrări` : ""}
        </span>
        {note && <span className="block text-[12px] text-stock-400">{note}</span>}
      </span>
    </li>
  );
}

/**
 * The one provenance component: a single summary line (SEAP sync, legal
 * check) that opens, on click, the truthful per-source detail — what was
 * collected when, and which source is delayed or not collected from this
 * server. Nothing here advances on a redeploy: every date is the
 * database's own record of a successful run.
 */
export default function FreshnessLine({ className }: { className?: string }) {
  const f = useFreshness();
  const [open, setOpen] = useState(false);
  const data = shared.data;
  if (!f || !data) return null;
  const d = data.datasets;
  const acts = Object.entries(data.legal.acts || {}).filter(([, v]) => v);
  return (
    <div className={cn("text-[13px] text-stock-500", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 rounded-lg text-left hover:text-ink"
      >
        <span className="inline-flex items-center gap-2">
          <Dot warn={f.tendersStale} />
          Sincronizat SEAP: <span className="tabular">{f.tendersMin === null ? "—" : ago(f.tendersMin)}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Dot warn={f.legalStale} />
          {f.legalLabel}: <span className="tabular">{f.legalDate ?? "—"}</span>
        </span>
        <span className="text-accent underline-offset-2 hover:underline">{open ? "Ascunde sursele" : "Surse și actualizare"}</span>
      </button>
      {open && (
        <div className="mt-3 max-w-xl rounded-xl border border-line-strong bg-paper px-4 py-2">
          <ul className="divide-y divide-divider">
            <SourceRow label="Proceduri SEAP (anunțuri de participare, achiziții directe)" iso={d.tenders?.last_synced_at} rows={d.tenders?.rows} warn={f.tendersStale} />
            <SourceRow label="Contracte atribuite (anunțuri de atribuire SEAP)" iso={d.award_outcomes?.last_synced_at} rows={d.award_outcomes?.rows} warn={minutesSince(d.award_outcomes?.last_synced_at) === null || (minutesSince(d.award_outcomes?.last_synced_at) as number) > 1440} />
            <SourceRow
              label="Apeluri de finanțare (MIPE / programe)"
              iso={d.funding_calls?.last_synced_at}
              rows={d.funding_calls?.rows}
              note={d.funding_calls?.last_synced_at ? undefined : "Sursa nu răspunde serverului nostru; nu afișăm date vechi drept actuale."}
              warn={!d.funding_calls?.last_synced_at}
            />
            <SourceRow
              label="Legislație (legislatie.just.ro) — reverificare săptămânală"
              iso={data.legal.checked_at}
              verb="verificare"
              note={acts.length ? `Forme consolidate: ${acts.map(([k, v]) => `${k} (${v})`).join(", ")}` : undefined}
              warn={f.legalStale}
            />
            <SourceRow label="Monitorizare acte noi (Portal legislativ, ANAP)" verb="verificare" iso={d.legal_watch?.last_synced_at} warn={minutesSince(d.legal_watch?.last_synced_at) === null} />
          </ul>
        </div>
      )}
    </div>
  );
}
