"use client";
import { useState } from "react";
import { ApiError, PLAN_CHANGED_EVENT, redeemAccessCode, type RedeemResult } from "@/lib/api";
import { Button, Input, Notice } from "@/components/newsprint";
import { cn } from "@/lib/utils";

function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/**
 * "Ai un cod de acces?" — the tester / promotional code box, on /abonament
 * and in the pricing dialog. A code grants its plan for its days; nothing
 * here is a payment. On success every plan meter re-reads the plan.
 */
export default function RedeemCodeCard({ className, onRedeemed }: { className?: string; onRedeemed?: (r: RedeemResult) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RedeemResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = code.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await redeemAccessCode(value);
      setDone(result);
      setCode("");
      window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));
      onRedeemed?.(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Codul nu a putut fi verificat. Reîncercați.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn("rounded-xl border border-line-strong bg-paper p-4 sm:p-5", className)} aria-labelledby="redeem-title">
      <h2 id="redeem-title" className="text-[15px] font-semibold text-ink">
        Ai un cod de acces Partener Fondator sau cod promoțional?
      </h2>
      {done ? (
        <div className="mt-3" role="status">
          <Notice title={done.message}>
            Planul {done.plan_label} este activ pe contul dvs. — valabil până la <b className="tabular">{day(done.expires_at)}</b>. După
            această dată contul revine la planul gratuit, fără nicio plată.
          </Notice>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="redeem-code" className="sr-only">
            Cod de acces
          </label>
          <Input
            id="redeem-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ex. FOUNDER-FIRMA-7A9K"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={80}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "redeem-error" : undefined}
            className="tabular sm:flex-1"
          />
          <Button type="submit" disabled={busy || !code.trim()} className="sm:w-auto">
            {busy ? "Se verifică…" : "Activează acces"}
          </Button>
        </form>
      )}
      {error && (
        <p id="redeem-error" className="mt-2 text-[14px] text-negative" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
