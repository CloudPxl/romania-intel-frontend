"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button, Eyebrow, Notice } from "@/components/newsprint";

/**
 * OAuth / magic-link landing page.
 *
 * This was previously a server route (route.ts) that called
 * exchangeCodeForSession() on the server and redirected to "/". That could
 * never work: supabase-js uses the PKCE flow, and the code verifier is
 * generated and stored in the *browser's* localStorage when the sign-in
 * starts. The server has no access to it, so the exchange failed silently
 * and the user was bounced to the home page still signed out — with no
 * error shown anywhere. The exchange has to happen client-side, in the
 * same browser context that began the flow.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      const url = new URL(window.location.href);
      const errorDescription = url.searchParams.get("error_description");
      if (errorDescription) {
        if (!cancelled) setError(errorDescription);
        return;
      }

      // A session may already exist: the client is created with
      // detectSessionInUrl enabled, so it can consume the fragment/code
      // before this effect runs. Only exchange explicitly if it did not.
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        if (!cancelled) router.replace("/");
        return;
      }

      const code = url.searchParams.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (!cancelled) setError(exchangeError.message);
          return;
        }
        if (!cancelled) router.replace("/");
        return;
      }

      if (!cancelled) setError("Linkul de autentificare este incomplet sau a expirat.");
    }

    complete().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Autentificarea nu a putut fi finalizată.");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto flex w-full max-w-screen-xl flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-divider bg-surface p-6 sm:p-8">
        <Eyebrow className="text-editorial">Autentificare</Eyebrow>
        {error ? (
          <>
            <h1 className="font-display mt-2 text-2xl font-semibold leading-tight">Nu am putut finaliza</h1>
            <div className="mt-4">
              <Notice tone="alert">{error}</Notice>
            </div>
            <Button onClick={() => router.replace("/login")} fullWidth className="mt-6">
              Înapoi la autentificare
            </Button>
          </>
        ) : (
          <>
            <h1 className="font-display mt-2 text-2xl font-semibold leading-tight">Se finalizează sesiunea…</h1>
            <p className="font-body mt-3 text-sm leading-relaxed text-stock-600">
              Vă redirecționăm în câteva momente.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-editorial" aria-hidden="true" />
              <span className="label-eyebrow text-stock-500">Verificare token</span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
