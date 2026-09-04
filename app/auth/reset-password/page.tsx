"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button, Eyebrow, Input, Notice } from "@/components/newsprint";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Landing page for a Supabase "reset password" email link.
 *
 * Mirrors app/auth/callback/page.tsx's code-exchange exactly, for the same
 * reason documented there: the client uses the PKCE flow, and the code
 * verifier lives in this browser's localStorage, so the exchange has to
 * happen here rather than on a server route. The one difference is what
 * happens after the exchange succeeds — the OAuth/magic-link callback
 * redirects straight to "/", but a recovery session's only purpose is to
 * authorize setting a new password, so this shows that form first.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const url = new URL(window.location.href);
      const errorDescription = url.searchParams.get("error_description");
      if (errorDescription) {
        if (!cancelled) setLinkError(errorDescription);
        return;
      }

      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        if (!cancelled) setReady(true);
        return;
      }

      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) setLinkError(error.message);
          return;
        }
        if (!cancelled) setReady(true);
        return;
      }

      if (!cancelled) setLinkError("Linkul de resetare este incomplet sau a expirat.");
    }

    establishSession().catch((e) => {
      if (!cancelled) setLinkError(e instanceof Error ? e.message : "Nu am putut valida linkul de resetare.");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit: React.ComponentProps<"form">["onSubmit"] = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Parola trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere.`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Parolele introduse nu coincid.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/"), 1500);
  };

  return (
    <main className="mx-auto flex w-full max-w-screen-xl flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md neu-flat rounded-3xl bg-paper p-6 sm:p-8">
        <Eyebrow className="text-editorial">Resetare parolă</Eyebrow>

        {linkError ? (
          <>
            <h1 className="font-display mt-2 text-2xl font-semibold leading-tight">Nu am putut valida linkul</h1>
            <div className="mt-4">
              <Notice tone="alert">{linkError}</Notice>
            </div>
            <Button onClick={() => router.replace("/login")} fullWidth className="mt-6">
              Înapoi la autentificare
            </Button>
          </>
        ) : !ready ? (
          <>
            <h1 className="font-display mt-2 text-2xl font-semibold leading-tight">Se validează linkul…</h1>
            <div className="mt-6 flex items-center gap-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-editorial" aria-hidden="true" />
              <span className="label-eyebrow text-stock-500">Verificare token</span>
            </div>
          </>
        ) : done ? (
          <>
            <h1 className="font-display mt-2 text-2xl font-semibold leading-tight">Parolă actualizată</h1>
            <p className="font-body mt-3 text-sm leading-relaxed text-stock-600">
              Vă redirecționăm către contul dvs.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display mt-2 text-2xl font-semibold leading-tight">Alegeți o parolă nouă</h1>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <Eyebrow className="mb-1.5 text-stock-600">Parolă nouă</Eyebrow>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Eyebrow className="mb-1.5 text-stock-600">Confirmați parola</Eyebrow>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={submitting} fullWidth>
                {submitting ? "Se salvează…" : "Salvează parola"}
              </Button>
              {formError && <Notice tone="alert">{formError}</Notice>}
            </form>
          </>
        )}
      </div>
    </main>
  );
}
