"use client";
import { useEffect, useState } from "react";
import { fetchDataFreshness, type DataFreshness } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One quiet line saying how current the data behind every page is: when the
 * tender feed last moved and when the statutory texts were last checked
 * against legislatie.just.ro. A bidder deciding on a deadline or a threshold
 * should not have to trust that "live" means live.
 *
 * Reads the public /system/freshness (cached server-side until the next
 * ingestion tick) every five minutes; renders nothing until it has answered,
 * and nothing at all if the API is unreachable — a missing line is better
 * than a wrong one.
 */
const REFRESH_MS = 5 * 60 * 1000;
// Ticks run every 5 minutes and most sources poll every 6-24 hours; two
// hours without a single row moving is worth a warning colour.
const TENDERS_STALE_AFTER_MIN = 120;
const LEGAL_STALE_AFTER_DAYS = 8;

function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.round((Date.now() - t) / 60000)) : null;
}

function ago(minutes: number): string {
  if (minutes < 1) return "acum";
  if (minutes < 60) return `acum ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `acum ${hours} h`;
  return `acum ${Math.round(hours / 24)} zile`;
}

export default function FreshnessLine({ className }: { className?: string }) {
  const [data, setData] = useState<DataFreshness | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = () =>
      fetchDataFreshness()
        .then((d) => mounted && setData(d))
        .catch(() => {});
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  if (!data) return null;
  const tendersMin = minutesSince(data.datasets.tenders?.last_synced_at);
  const legalMin = minutesSince(data.legal.checked_at);
  const tendersStale = tendersMin === null || tendersMin > TENDERS_STALE_AFTER_MIN;
  const legalStale =
    !data.legal.synced || legalMin === null || legalMin > LEGAL_STALE_AFTER_DAYS * 1440 || data.legal.thresholds_match === false;

  return (
    <div
      className={cn("px-3 py-1.5 text-[11px] leading-snug text-stock-500", className)}
      title={
        "Licitații: ultima actualizare a datelor din surse. " +
        "Legislație: ultima verificare automată a textelor consolidate pe legislatie.just.ro."
      }
    >
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", tendersStale ? "bg-warning" : "bg-positive")}
        />
        <span className="truncate">
          Licitații {tendersMin === null ? "— fără date" : `actualizate ${ago(tendersMin)}`}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span aria-hidden className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", legalStale ? "bg-warning" : "bg-positive")} />
        <span className="truncate">
          {data.legal.thresholds_match === false
            ? "Legislație: praguri de reverificat"
            : data.legal.synced && data.legal.checked_at
              ? `Legislație verificată ${formatDate(data.legal.checked_at)}`
              : "Legislație: verificare în curs"}
        </span>
      </div>
    </div>
  );
}
