"use client";
import { useEffect, useState } from "react";
import { fetchAiUsage, type AiUsage } from "@/lib/api";

/**
 * The account's AI credits for this month, shown beside the actions that
 * spend them. Plans used to promise an "unlimited" copilot; now every AI
 * action counts against a visible allowance, and a person should see what
 * is left before they press the button, not learn it from a refusal.
 *
 * `refreshKey` re-reads the meter after an action that may have spent a
 * credit. Renders nothing until it has a real answer — a meter showing
 * zeros while loading reads as "you have nothing left".
 */
export default function AiCredits({ refreshKey = 0, className = "" }: { refreshKey?: number; className?: string }) {
  const [usage, setUsage] = useState<AiUsage | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchAiUsage()
      .then((u) => mounted && setUsage(u))
      .catch(() => mounted && setUsage(null));
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  if (!usage) return null;

  const renews = usage.resets_at.split("-").reverse().join(".");
  const low = (k: "deliverable" | "copilot") => usage.remaining[k] <= Math.max(1, Math.floor(usage.limits[k] * 0.1));

  return (
    <div
      className={"neu-pressed-sm inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-paper px-3 py-1.5 font-mono text-[11px] text-stock-600 " + className}
      aria-label="Credite AI rămase luna aceasta"
    >
      <span className="font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">Credite AI</span>
      <span className={low("deliverable") ? "text-warning" : ""}>
        Documente {usage.remaining.deliverable}/{usage.limits.deliverable}
      </span>
      <span className={low("copilot") ? "text-warning" : ""}>
        Copilot {usage.remaining.copilot}/{usage.limits.copilot}
      </span>
      <span className="text-stock-500">· {usage.plan_label} · reînnoire {renews}</span>
      {(usage.platform_paused || usage.free_pool_exhausted) && (
        <span className="text-warning">
          {usage.platform_paused ? "AI suspendat azi — documentele standard rămân complete" : "fondul AI gratuit s-a epuizat luna aceasta"}
        </span>
      )}
    </div>
  );
}
