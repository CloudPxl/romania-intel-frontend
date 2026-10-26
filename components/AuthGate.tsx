"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ButtonLink, Loading, Notice } from "@/components/newsprint";
import OnboardingForm from "@/components/OnboardingForm";
import { currentPath, loginHref, rememberNext } from "@/lib/authRedirect";

/**
 * Wraps any page whose data comes from an authenticated backend route.
 *
 * Every tool is in the FREE account, so a signed-out visitor sees exactly
 * that, and a way in that returns to this page. "Not signed in" and
 * "signed in but the backend rejected the session" are different problems
 * with different fixes, and are told apart.
 */
export const GATE_HEADLINE = "Disponibil în contul gratuit — Creează cont în 10 secunde";

export default function AuthGate({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  /** The tool's name, shown as the kicker (e.g. "Pipeline ofertare"). */
  title?: string;
  /** What the tool does, one sentence. */
  description?: string;
}) {
  const { user, loading, authError, needsOnboarding } = useAuth();
  // `/login?next=<this page>`, built after mount: the server render has no
  // URL to read, and a different href on the client would not hydrate.
  const [loginTarget, setLoginTarget] = useState("/login");
  useEffect(() => setLoginTarget(loginHref()), []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1264px] px-5 py-10 sm:px-8">
        <Loading label="Se verifică sesiunea" />
      </div>
    );
  }

  if (needsOnboarding) return <OnboardingForm />;

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-[1264px] px-5 py-12 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-xl rounded-xl border border-line-strong bg-paper p-6 sm:p-8">
          {title && <p className="label-eyebrow text-accent">{title}</p>}
          <h1 className="mt-2 text-2xl font-semibold leading-[30px] tracking-[-0.015em] text-ink">{GATE_HEADLINE}</h1>
          {description && <p className="mt-3 text-[16px] leading-[26px] text-stock-600">{description}</p>}
          <p className="mt-2 text-[15px] leading-6 text-stock-500">Doar emailul, fără card și fără parolă: primiți un link și vă întoarceți exact pe această pagină.</p>
          {authError && (
            <div className="mt-5">
              <Notice tone="alert" title="Sesiune respinsă de server">
                {authError}
              </Notice>
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <ButtonLink href={loginTarget} className="sm:flex-1" onClick={() => rememberNext(currentPath())}>
              Creează cont gratuit
            </ButtonLink>
            <ButtonLink href={loginTarget} variant="outline" className="sm:flex-1" onClick={() => rememberNext(currentPath())}>
              Am deja cont
            </ButtonLink>
          </div>
          <p className="mt-4 text-[14px] text-stock-500">
            Fără cont puteți vedea{" "}
            <a href="/analysis" className="font-medium text-accent underline underline-offset-2">
              analiza publică a pieței
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
