"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotFound from "@/app/not-found";
import { useAuth } from "@/context/AuthContext";
import { ApiError, fetchOpsMe, type OpsMe, type OpsMetric } from "@/lib/api";
import { Button, Explainer, Field, Input, Loading, Notice, Textarea } from "@/components/newsprint";
import { cn } from "@/lib/utils";

/**
 * The operations console frame. It asks the server who the caller is
 * (GET /api/v1/ops/me) and renders the console only on a 200. Anyone else
 * — signed out, a customer, a revoked collaborator — sees the site's normal
 * 404, exactly what an unknown URL shows. This is presentation only: every
 * figure and action behind it is authorized again by the API.
 */

const OpsContext = createContext<OpsMe | null>(null);

export function useOps(): OpsMe {
  const me = useContext(OpsContext);
  if (!me) throw new Error("useOps outside OpsShell");
  return me;
}

export function useCan(capability: string): boolean {
  return useOps().capabilities.includes(capability);
}

const NAV: { href: string; label: string; cap: string }[] = [
  { href: "/ops", label: "Situație", cap: "health.view" },
  { href: "/ops/users", label: "Conturi", cap: "users.view" },
  { href: "/ops/codes", label: "Coduri", cap: "promo.view" },
  { href: "/ops/staff", label: "Acces", cap: "staff.view" },
  { href: "/ops/audit", label: "Jurnal", cap: "audit.view" },
];

export default function OpsShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [me, setMe] = useState<OpsMe | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "hidden" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    let live = true;
    fetchOpsMe()
      .then((m) => live && (setMe(m), setState("ok")))
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 401)) setState("hidden");
        else {
          setError(e instanceof ApiError ? e.detail : "Consola nu a răspuns.");
          setState("error");
        }
      });
    return () => {
      live = false;
    };
  }, [user, loading]);

  if (!loading && !user) return <NotFound />;
  if (state === "loading") {
    return (
      <div className="mx-auto w-full max-w-[1264px] px-5 py-10 sm:px-8">
        <Loading label="Se verifică accesul" />
      </div>
    );
  }
  if (state === "hidden" || !me) {
    if (state === "error") {
      return (
        <div className="mx-auto w-full max-w-[1264px] px-5 py-10 sm:px-8">
          <Notice tone="alert" title="Consola nu este disponibilă">{error}</Notice>
        </div>
      );
    }
    return <NotFound />;
  }

  return (
    <OpsContext.Provider value={me}>
      <div className="mx-auto w-full max-w-[1264px] px-5 pb-20 pt-6 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-3">
          <div className="min-w-0">
            <p className="label-eyebrow text-accent">RO-INTEL Operations</p>
            <p className="mt-0.5 truncate text-[13px] text-stock-500">
              {me.email} · {me.role_label}
              {me.expires_at ? ` · acces până la ${formatDateTime(me.expires_at)}` : ""}
            </p>
          </div>
          <nav aria-label="Secțiuni consolă" className="scroll-x -mx-1 flex max-w-full gap-1">
            {NAV.filter((n) => me.capabilities.includes(n.cap)).map((n) => {
              const active = n.href === "/ops" ? pathname === "/ops" : pathname?.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-3 text-[14px] font-medium",
                    active ? "bg-ink text-white" : "text-stock-600 hover:bg-surface-2 hover:text-ink"
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="pt-6">{children}</div>
      </div>
    </OpsContext.Provider>
  );
}

/* ------------------------------------------------------------ building blocks */

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function ago(value: string | null | undefined): string {
  if (!value) return "niciodată";
  const s = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (Number.isNaN(s)) return "—";
  if (s < 90) return "acum un minut";
  if (s < 3600) return `acum ${Math.round(s / 60)} min`;
  if (s < 172800) return `acum ${Math.round(s / 3600)} h`;
  return `acum ${Math.round(s / 86400)} zile`;
}

/** One figure, always with what it means, over which window, from where,
 *  and what it does not show. `tone` marks a figure that needs action. */
export function MetricTile({ m, tone }: { m: OpsMetric; tone?: "warning" | "negative" }) {
  const value = typeof m.value === "number" ? new Intl.NumberFormat("ro-RO").format(m.value) : m.value ?? "—";
  return (
    <div className="bg-paper p-4 sm:p-5">
      <p className={cn("tabular text-[24px] font-medium leading-[30px] tracking-[-0.02em]", tone === "negative" ? "text-negative" : tone === "warning" ? "text-warning" : "text-ink")}>
        {value}
      </p>
      <p className="mt-1.5 flex items-start gap-1 text-[14px] leading-5 text-stock-600">
        <span>{m.label}</span>
        <Explainer title={m.label}>
          <span className="block">{m.definition}</span>
          <span className="mt-2 block text-stock-500">Interval: {m.window}</span>
          <span className="block text-stock-500">Sursă: <code className="font-mono text-[12px]">{m.source}</code></span>
          {m.limitation && <span className="mt-2 block text-stock-500">Limită: {m.limitation}</span>}
        </Explainer>
      </p>
      <p className="tabular mt-1 text-[12px] leading-4 text-stock-400">{m.window}</p>
    </div>
  );
}

export function MetricGrid({ metrics, toneFor }: { metrics: OpsMetric[]; toneFor?: (m: OpsMetric) => "warning" | "negative" | undefined }) {
  return (
    // Each tile draws its own right/bottom hairline; the grid is pulled 1px
    // under the card's edge so the outermost lines disappear. A short last
    // row then ends in paper, not in a grey gap.
    <div className="overflow-hidden rounded-xl border border-line-strong bg-paper">
      <div className="-mb-px -mr-px grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.key} className="border-b border-r border-line-strong">
            <MetricTile m={m} tone={toneFor?.(m)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionHead({ title, note, children }: { title: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-end justify-between gap-2 first:mt-0">
      <div>
        <h2 className="text-[18px] font-semibold leading-6 text-ink">{title}</h2>
        {note && <p className="mt-0.5 text-[13px] leading-5 text-stock-500">{note}</p>}
      </div>
      {children}
    </div>
  );
}

/** Polls `load` every `intervalMs` while the tab is visible; manual refresh
 *  and the time of the last successful load are part of the contract. */
export function usePolling<T>(load: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setData(await loadRef.current());
      setError("");
      setLoadedAt(new Date());
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Cererea a eșuat.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(refresh, 0);
    if (!intervalMs) return () => window.clearTimeout(first);
    const id = window.setInterval(() => document.visibilityState === "visible" && refresh(), intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [refresh, intervalMs]);

  return { data, error, loadedAt, busy, refresh };
}

export function RefreshBar({ loadedAt, busy, onRefresh, every }: { loadedAt: Date | null; busy: boolean; onRefresh: () => void; every?: string }) {
  return (
    <div className="flex items-center gap-3 text-[13px] text-stock-500">
      <span className="tabular" aria-live="polite">
        {loadedAt ? `Actualizat la ${loadedAt.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Se încarcă…"}
        {every ? ` · reîmprospătare ${every}` : ""}
      </span>
      <Button variant="outline" className="min-h-9 px-3 text-[13px]" onClick={onRefresh} disabled={busy}>
        {busy ? "Se încarcă…" : "Reîmprospătează"}
      </Button>
    </div>
  );
}

/**
 * Confirmation for a consequential action: states the consequence, needs a
 * written reason, and — for actions on an account — the account's e-mail
 * typed back. The server checks both again.
 */
export function ConfirmAction({
  title,
  consequence,
  confirmLabel,
  expected,
  expectedLabel,
  onConfirm,
  onCancel,
  danger = true,
  extra,
}: {
  title: string;
  consequence: React.ReactNode;
  confirmLabel: string;
  /** When set, the operator must type this value back (case-insensitive). */
  expected?: string;
  expectedLabel?: string;
  onConfirm: (reason: string, typed: string) => Promise<void>;
  onCancel: () => void;
  danger?: boolean;
  extra?: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const ok = reason.trim().length >= 10 && (!expected || typed.trim().toLowerCase() === expected.trim().toLowerCase());

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>("textarea, input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ops-confirm-title" className="w-full max-w-lg rounded-t-2xl border border-line-strong bg-paper p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <h2 id="ops-confirm-title" className="text-[18px] font-semibold text-ink">{title}</h2>
        <div className="mt-2 text-[15px] leading-6 text-stock-600">{consequence}</div>
        <div className="mt-4 space-y-3">
          {extra}
          <Field label="Motiv (minim 10 caractere, apare în jurnal)">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="min-h-[5rem]" />
          </Field>
          {expected && (
            <Field label={expectedLabel || "Tastați pentru confirmare"} hint={expected}>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
            </Field>
          )}
          {error && <Notice tone="alert">{error}</Notice>}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Renunță</Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onConfirm(reason.trim(), typed.trim());
              } catch (e) {
                setError(e instanceof ApiError ? e.detail : "Acțiunea a eșuat.");
                setBusy(false);
              }
            }}
          >
            {busy ? "Se aplică…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  const rows = React.Children.count(children);
  return (
    <div className="scroll-x overflow-hidden rounded-xl border border-line-strong bg-paper">
      <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-divider bg-surface-2 text-[12px] uppercase tracking-[0.04em] text-stock-500">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {rows ? children : (
            <tr>
              <td colSpan={head.length} className="px-3 py-8 text-center text-stock-500">{empty || "Nimic de afișat."}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
