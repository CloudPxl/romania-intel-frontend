"use client";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { ButtonLink, Eyebrow, Loading, Notice } from "@/components/newsprint";

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
  title = "Autentificare necesară",
  description = "Acest instrument citește date din registrul RO-INTEL. Conectați-vă pentru a continua.",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const { user, loading, authError } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-screen-xl px-4 py-10">
        <Loading label="Se verifică sesiunea" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-screen-xl px-4 py-12 sm:py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-divider bg-surface p-6 sm:p-10">
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
            <ButtonLink href="/login" variant="primary" className="sm:flex-1">
              Autentificare
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
