"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeAuthFromUrl } from "@/lib/authCallback";
import { consumeNext } from "@/lib/authRedirect";
import { Button, Eyebrow, Notice } from "@/components/newsprint";

/**
 * OAuth / magic-link landing page. The URL is turned into a session by
 * lib/authCallback.ts (token_hash links, PKCE codes, provider errors), then
 * the visitor goes where they were headed (?next=…, see lib/authRedirect.ts)
 * instead of always to "/".
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const href = window.location.href;
    const next = new URL(href).searchParams.get("next");
    completeAuthFromUrl(href).then((result) => {
      if (cancelled) return;
      if (result.ok) router.replace(consumeNext(next));
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto flex w-full max-w-screen-xl flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md neu-flat rounded-3xl bg-paper p-6 sm:p-8">
        <Eyebrow className="text-accent">Autentificare</Eyebrow>
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
