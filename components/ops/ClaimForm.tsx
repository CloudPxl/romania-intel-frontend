"use client";

import { useEffect, useState } from "react";
import NotFound from "@/app/not-found";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { Button, ButtonLink, Field, Input, Loading, Notice } from "@/components/newsprint";

/**
 * Redeems a one-time console token (owner bootstrap or staff invitation)
 * for the signed-in account. Signed out: the ordinary 404 — the page does
 * not explain itself to strangers. The token is read from the URL fragment
 * (never sent to any server, never in a Referer), removed from the address
 * bar at once, and posted only to the API.
 */
export default function ClaimForm({
  kicker,
  title,
  intro,
  submitLabel,
  claim,
  fromFragment,
}: {
  kicker: string;
  title: string;
  intro: React.ReactNode;
  submitLabel: string;
  claim: (token: string) => Promise<{ role_label: string }>;
  fromFragment: boolean;
}) {
  const { user, loading } = useAuth();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!fromFragment) return;
    const m = window.location.hash.match(/[#&]t=([A-Za-z0-9_-]{20,200})/);
    if (m) {
      setToken(m[1]);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [fromFragment]);

  if (loading) return <div className="mx-auto w-full max-w-[1264px] px-5 py-10 sm:px-8"><Loading label="Se verifică sesiunea" /></div>;
  if (!user) {
    // Someone holding an invitation link: tell them to sign in first (the
    // token stays in their link; nothing is stored here). Anyone else: 404.
    const hasLinkToken = fromFragment && typeof window !== "undefined" && /[#&]t=/.test(window.location.hash);
    if (!hasLinkToken) return <NotFound />;
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="label-eyebrow text-accent">{kicker}</p>
        <h1 className="mt-2 text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-ink">{title}</h1>
        <p className="mt-3 text-[15px] leading-6 text-stock-600">
          Autentificați-vă întâi cu adresa de email pe care ați primit invitația, apoi deschideți din nou linkul din mesaj.
        </p>
        <div className="mt-6"><ButtonLink href="/login">Autentificare</ButtonLink></div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="label-eyebrow text-accent">{kicker}</p>
      <h1 className="mt-2 text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-ink">{title}</h1>
      <div className="mt-3 text-[15px] leading-6 text-stock-600">{intro}</div>
      <p className="mt-3 text-[14px] text-stock-500">Autentificat ca <b className="font-semibold text-ink">{user.email}</b>. Tokenul funcționează doar pentru emailul căruia i-a fost emis.</p>
      {done ? (
        <div className="mt-6 space-y-4">
          <Notice title="Acces activat">Rol: {done}. Acțiunea a fost înregistrată în jurnalul de audit.</Notice>
          <ButtonLink href="/ops">Deschide consola</ButtonLink>
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await claim(token.trim());
              setDone(r.role_label);
              setToken("");
            } catch (err) {
              setError(err instanceof ApiError ? err.detail : "Cererea a eșuat.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Token">
            <Input value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" required minLength={20} maxLength={200} />
          </Field>
          {error && <Notice tone="alert">{error}</Notice>}
          <Button type="submit" disabled={busy || token.trim().length < 20}>{busy ? "Se verifică…" : submitLabel}</Button>
        </form>
      )}
    </div>
  );
}
