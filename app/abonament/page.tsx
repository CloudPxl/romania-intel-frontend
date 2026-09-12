"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CircleAlert, CreditCard } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import { ApiError, fetchMySubscription, type SubscriptionState } from "@/lib/api";
import { PricingModal } from "@/components/EnterpriseModals";
import { Button, ButtonLink, Eyebrow, Loading, Notice, PageHeader, Panel } from "@/components/newsprint";

const PLAN_LABELS: Record<string, string> = {
  plan_acces_complet: "Acces Complet",
  plan_founder_vip: "VIP Multi-Divizie",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Activ",
  trialing: "Perioadă de probă",
  past_due: "Plată restantă",
  unpaid: "Neachitat",
  canceled: "Anulat",
  inactive: "Fără abonament",
};

/**
 * Where Stripe Checkout returns to, and the page that states the current
 * subscription.
 *
 * The success case is deliberately careful about what it claims. Stripe
 * redirects the browser here the moment payment is taken, but the
 * subscription is only really active once the *webhook* has been received
 * and written to the profile — those are different events and the redirect
 * usually wins the race. Rather than assert "you are subscribed" from a URL
 * parameter the user could type themselves, this polls the backend for a
 * few seconds and reports what the server actually knows.
 */
function SubscriptionContent() {
  const params = useSearchParams();
  const outcome = params.get("status");
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stillPending, setStillPending] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Up to ~10s of polling on the success path only; a plain load asks once.
    const attempts = outcome === "succes" ? 6 : 1;

    (async () => {
      for (let i = 0; i < attempts; i += 1) {
        try {
          const state = await fetchMySubscription();
          if (cancelled) return;
          setSubscription(state);
          setLoading(false);
          if (state.is_active || attempts === 1) return;
        } catch (e) {
          if (cancelled) return;
          setError(e instanceof ApiError ? e.detail : "Starea abonamentului nu a putut fi citită.");
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 1800));
      }
      if (!cancelled) setStillPending(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [outcome]);

  const active = subscription?.is_active === true;

  return (
    <div className="mx-auto w-full max-w-screen-md px-4 py-8 sm:py-10">
      <PageHeader
        eyebrow="Cont"
        title="Abonament"
        standfirst="Starea abonamentului dvs. și opțiunile de plată."
      />

      {outcome === "anulat" && (
        <div className="mb-6">
          <Notice tone="warning" title="Plată anulată">
            Nu a fost efectuată nicio plată. Puteți relua oricând sau puteți solicita o factură
            proformă pentru plata prin ordin de plată.
          </Notice>
        </div>
      )}

      {outcome === "succes" && active && (
        <div className="mb-6">
          <Notice tone="neutral" title="Plată confirmată">
            Abonamentul este activ. Vă mulțumim!
          </Notice>
        </div>
      )}

      {outcome === "succes" && !active && stillPending && (
        <div className="mb-6">
          {/* Honest about the race rather than asserting success from a URL
              parameter: the redirect routinely arrives before Stripe's
              webhook has been processed. */}
          <Notice tone="warning" title="Plata este în curs de confirmare">
            Plata a fost înregistrată de procesator, dar confirmarea nu a ajuns încă la noi.
            Activarea durează de obicei câteva secunde — reîncărcați pagina. Dacă starea nu se
            schimbă în câteva minute, scrieți-ne la cloudpxlsupport@gmail.com.
          </Notice>
        </div>
      )}

      {loading ? (
        <Loading label="Se verifică abonamentul" />
      ) : error ? (
        <Notice tone="alert">{error}</Notice>
      ) : (
        <Panel className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={
                  "neu-flat-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl " +
                  (active ? "bg-editorial-soft text-positive" : "bg-paper text-stock-500")
                }
              >
                {active ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}
              </span>
              <div>
                <Eyebrow className="text-stock-500">Stare</Eyebrow>
                <p className="font-display mt-1 text-xl font-bold text-ink">
                  {STATUS_LABELS[subscription?.status || "inactive"] || subscription?.status}
                </p>
                {subscription?.plan_id && (
                  <p className="font-body mt-1 text-sm text-stock-600">
                    Plan: {PLAN_LABELS[subscription.plan_id] || subscription.plan_id}
                  </p>
                )}
                {subscription?.current_period_end && (
                  <p className="font-body mt-1 text-sm text-stock-500">
                    {active ? "Se reînnoiește" : "Valabil până"} la{" "}
                    {new Date(subscription.current_period_end).toLocaleDateString("ro-RO")}
                  </p>
                )}
              </div>
            </div>

            <Button onClick={() => setPricingOpen(true)} className="min-h-[44px]">
              <CreditCard size={16} />
              {active ? "Schimbă planul" : "Vezi planurile"}
            </Button>
          </div>

          {subscription?.status === "past_due" && (
            <div className="mt-5">
              <Notice tone="alert" title="Plata nu a putut fi procesată">
                Ultima plată a eșuat. Actualizați metoda de plată pentru a evita întreruperea
                accesului.
              </Notice>
            </div>
          )}
        </Panel>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/" variant="outline" className="min-h-[44px]">
          Înapoi la prima pagină
        </ButtonLink>
        <ButtonLink href="/suport" variant="ghost" className="min-h-[44px]">
          Contactează suportul
        </ButtonLink>
      </div>

      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <AuthGate
      title="Autentificare necesară"
      description="Starea abonamentului este legată de contul dvs. Conectați-vă pentru a o vedea."
    >
      {/* useSearchParams needs a Suspense boundary or the whole route opts
          out of static prerendering. */}
      <Suspense fallback={<Loading label="Se încarcă" />}>
        <SubscriptionContent />
      </Suspense>
    </AuthGate>
  );
}
