"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ButtonLink, Eyebrow, Loading, Notice } from "@/components/newsprint";
import OnboardingForm from "@/components/OnboardingForm";
import { currentPath, loginHref, rememberNext } from "@/lib/authRedirect";

/**
 * Wraps any page whose data comes from an authenticated backend route.
 *
 * Every tool route is now gated server-side (api.py mounts
 * Depends(require_auth) on them), so rendering the tool for a signed-out
 * visitor would only produce a wall of 401s. This shows the reason and a
 * way in instead — and, critically, distinguishes "not signed in" from
 * "signed in but the backend rejected the session", which are different
 * problems with different fixes.
 */
export default function AuthGate({
  children,
  title = "Disponibil în contul gratuit",
  description = "Creați un cont gratuit (doar emailul, fără card) sau autentificați-vă — vă întoarceți exact pe această pagină.",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const { user, loading, authError, needsOnboarding } = useAuth();
  // `/login?next=<this page>`, built after mount: the server render has no
  // URL to read, and a different href on the client would not hydrate.
  const [loginTarget, setLoginTarget] = useState("/login");
  useEffect(() => setLoginTarget(loginHref()), []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-xl px-4 py-10">
        <Loading label="Se verifică sesiunea" />
      </div>
    );
  }

  if (needsOnboarding) {
    return <OnboardingForm />;
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-screen-xl px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-xl neu-flat rounded-3xl bg-paper p-6 sm:p-10">
          <Eyebrow className="text-editorial">Acces restricționat</Eyebrow>
          <h1 className="font-display mt-3 text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
          <p className="font-body mt-3 text-sm leading-relaxed text-stock-600">{description}</p>

          {authError && (
            <div className="mt-5">
              <Notice tone="alert" title="Sesiune respinsă de server">
                {authError}
              </Notice>
            </div>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={loginTarget} variant="primary" className="sm:flex-1" onClick={() => rememberNext(currentPath())}>
              Creează cont gratuit sau autentifică-te
            </ButtonLink>
            <ButtonLink href="/analysis" variant="outline" className="sm:flex-1">
              Vezi analiza publică
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
