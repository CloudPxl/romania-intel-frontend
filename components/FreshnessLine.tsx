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

/** The header's pill: SEAP freshness, the legal check on hover. */
export function FreshnessPill({ className }: { className?: string }) {
  const f = useFreshness();
  if (!f) return null;
  return (
    <span
      className={cn("inline-flex h-8 items-center gap-2 rounded-full border border-divider bg-paper px-3 text-[13px] text-stock-500", className)}
      title={`${f.legalLabel}${f.legalDate ? ` — ${f.legalDate}` : ""}`}
    >
      <Dot warn={f.tendersStale || f.legalStale} />
      SEAP <span className="tabular text-stock-400">{f.tendersMin === null ? "—" : ago(f.tendersMin)}</span>
    </span>
  );
}

/** The footer's line: both datasets, spelled out. */
export default function FreshnessLine({ className }: { className?: string }) {
  const f = useFreshness();
  if (!f) return null;
  return (
    <p className={cn("flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-stock-500", className)}>
      <span className="inline-flex items-center gap-2">
        <Dot warn={f.tendersStale} />
        Registrul actualizat <span className="tabular">{f.tendersMin === null ? "—" : ago(f.tendersMin)}</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <Dot warn={f.legalStale} />
        {f.legalLabel} <span className="tabular">{f.legalDate ?? "—"}</span>
      </span>
    </p>
  );
}
