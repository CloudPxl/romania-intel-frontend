"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatDateline } from "@/lib/format";
import { Button, Eyebrow, Input, Notice, TabBar } from "@/components/newsprint";

const METHODS = [
  { id: "magic", label: "Magic link" },
  { id: "password", label: "Parolă" },
] as const;
type AuthMethod = (typeof METHODS)[number]["id"];

const MIN_PASSWORD_LENGTH = 8;

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithPassword, signInWithPassword, requestPasswordReset, user, loading } =
    useAuth();
  const router = useRouter();
  const [dateline, setDateline] = useState("");
  const [method, setMethod] = useState<AuthMethod>("magic");

  // Magic link
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password: sign in / sign up, plus a nested "forgot password" mode.
  const [passwordMode, setPasswordMode] = useState<"signin" | "signup">("signin");
  const [password, setPassword] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => setDateline(formatDateline()), []);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const handleEmailSubmit: React.ComponentProps<"form">["onSubmit"] = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await signInWithEmail(email.trim());
    setSubmitting(false);
    if (err) setError(err);
    else setSent(true);
  };

  const handlePasswordSubmit: React.ComponentProps<"form">["onSubmit"] = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (passwordMode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setPwError(`Parola trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere.`);
      return;
    }
    setPwSubmitting(true);
    setPwError(null);
    if (passwordMode === "signup") {
      const { error: err, needsEmailConfirmation } = await signUpWithPassword(email.trim(), password);
      setPwSubmitting(false);
      if (err) {
        setPwError(err);
        return;
      }
      if (needsEmailConfirmation) {
        setConfirmEmailSent(true);
        return;
      }
      // No confirmation required by this Supabase project — a session was
      // granted immediately, and the redirect effect above takes it from here.
    } else {
      const { error: err } = await signInWithPassword(email.trim(), password);
      setPwSubmitting(false);
      if (err) setPwError(err);
    }
  };

  const handleResetSubmit: React.ComponentProps<"form">["onSubmit"] = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setResetSubmitting(true);
    setResetError(null);
    const { error: err } = await requestPasswordReset(email.trim());
    setResetSubmitting(false);
    if (err) setResetError(err);
    else setResetSent(true);
  };

  return (
    <main className="flex min-h-svh flex-col">
      <div className="mx-auto grid w-full max-w-screen-xl flex-1 grid-cols-1 lg:grid-cols-12">
        {/* Editorial column */}
        <section className="flex flex-col justify-center border-b border-divider px-4 py-10 sm:px-8 lg:col-span-7 lg:border-b-0 lg:border-r lg:py-16">
          <Eyebrow className="text-editorial">Intelligence achiziții publice · România</Eyebrow>
          <Link href="/" className="font-display mt-3 flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            <span className="neu-flat-sm flex h-9 w-9 items-center justify-center rounded-2xl bg-editorial text-base font-bold text-white">R</span>
            RO-INTEL
          </Link>
          <p className="font-mono mt-4 text-[11px] uppercase tracking-[0.2em] text-stock-500">
            {dateline || " "}
          </p>

          <p className="font-body mt-8 max-w-xl text-base leading-relaxed text-stock-600">
            Contractele publice se decid înainte de a fi publicate. Registrul urmărește consultările de piață,
            anunțurile de intenție și registrele de investiții din România și le transformă în semnale calificate,
            cu mult înainte ca procedura să apară în SEAP.
          </p>

          <ul className="mt-8 max-w-xl border-t border-divider">
            {[
              ["Surse reale, verificate", "Fiecare scraper citește o sursă publică specifică; o sursă indisponibilă raportează zero, nu date inventate."],
              ["Scor bazat pe dovezi", "Potrivirea cere dovadă în text — domeniul, județul și bugetul doar întăresc un rezultat, nu îl creează."],
              ["Documente utilizabile", "Propuneri tehnice și solicitări de clarificare conform Legii 98/2016 și Legii 544/2001."],
            ].map(([title, body]) => (
              <li key={title} className="border-b border-divider py-4">
                <h2 className="font-display text-lg font-bold leading-snug">{title}</h2>
                <p className="font-body mt-1 text-sm leading-relaxed text-stock-600">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Access column */}
        <section className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:col-span-5 lg:py-16">
          <div className="neu-flat rounded-3xl bg-paper p-5 sm:p-7">
            <Eyebrow className="text-editorial">Acces abonați</Eyebrow>
            <h2 className="font-display mt-2 text-2xl font-semibold leading-tight tracking-tight">Autentificare</h2>
            <p className="font-body mt-2 text-sm leading-relaxed text-stock-600">
              Registrul și instrumentele de ofertare sunt disponibile doar conturilor autentificate.
            </p>

            {loading ? (
              <p className="font-mono mt-6 text-xs uppercase tracking-widest text-stock-500">Se verifică sesiunea…</p>
            ) : (
              <>
                <Button onClick={signInWithGoogle} fullWidth className="mt-6">
                  Continuă cu Google
                </Button>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-divider" />
                  <span className="label-eyebrow text-stock-400">sau</span>
                  <span className="h-px flex-1 bg-divider" />
                </div>

                <TabBar
                  label="Metodă de autentificare"
                  tabs={METHODS}
                  active={method}
                  onChange={(id) => {
                    setMethod(id);
                    setError(null);
                    setPwError(null);
                    setResetError(null);
                  }}
                />

                {method === "magic" &&
                  (sent ? (
                    <Notice title="Link expediat">
                      Am trimis un link de autentificare la <b>{email}</b>. Deschideți-l de pe acest dispozitiv pentru a
                      intra în cont.
                    </Notice>
                  ) : (
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                      <div>
                        <Eyebrow className="mb-1.5 text-stock-600">Email profesional</Eyebrow>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nume@exemplu.ro"
                          required
                          autoComplete="email"
                          inputMode="email"
                        />
                      </div>
                      <Button type="submit" disabled={submitting} fullWidth>
                        {submitting ? "Se trimite…" : "Trimite magic link"}
                      </Button>
                      {error && (
                        <Notice tone="alert">{error}</Notice>
                      )}
                    </form>
                  ))}

                {method === "password" &&
                  (resetMode ? (
                    resetSent ? (
                      <Notice title="Email expediat">
                        Dacă există un cont pentru <b>{email}</b>, am trimis un link de resetare a parolei.
                      </Notice>
                    ) : (
                      <form onSubmit={handleResetSubmit} className="space-y-4">
                        <div>
                          <Eyebrow className="mb-1.5 text-stock-600">Email profesional</Eyebrow>
                          <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nume@exemplu.ro"
                            required
                            autoComplete="email"
                            inputMode="email"
                          />
                        </div>
                        <Button type="submit" disabled={resetSubmitting} fullWidth>
                          {resetSubmitting ? "Se trimite…" : "Trimite link de resetare"}
                        </Button>
                        {resetError && <Notice tone="alert">{resetError}</Notice>}
                        <button
                          type="button"
                          onClick={() => {
                            setResetMode(false);
                            setResetError(null);
                          }}
                          className="font-body block w-full text-center text-sm text-stock-500 underline decoration-dotted underline-offset-4 hover:text-ink"
                        >
                          Înapoi la autentificare
                        </button>
                      </form>
                    )
                  ) : confirmEmailSent ? (
                    <Notice title="Verificați email-ul">
                      Am trimis un link de confirmare la <b>{email}</b>. Confirmați adresa pentru a vă putea
                      autentifica cu parola aleasă.
                    </Notice>
                  ) : (
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      <div>
                        <Eyebrow className="mb-1.5 text-stock-600">Email profesional</Eyebrow>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nume@exemplu.ro"
                          required
                          autoComplete="email"
                          inputMode="email"
                        />
                      </div>
                      <div>
                        <Eyebrow className="mb-1.5 text-stock-600">Parolă</Eyebrow>
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={passwordMode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
                          autoComplete={passwordMode === "signup" ? "new-password" : "current-password"}
                        />
                      </div>
                      <Button type="submit" disabled={pwSubmitting} fullWidth>
                        {pwSubmitting
                          ? "Se procesează…"
                          : passwordMode === "signup"
                            ? "Creează cont"
                            : "Autentificare"}
                      </Button>
                      {pwError && <Notice tone="alert">{pwError}</Notice>}
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordMode((m) => (m === "signin" ? "signup" : "signin"));
                            setPwError(null);
                          }}
                          className="font-body text-stock-500 underline decoration-dotted underline-offset-4 hover:text-ink"
                        >
                          {passwordMode === "signin" ? "Nu aveți cont? Creați unul" : "Aveți deja cont? Autentificare"}
                        </button>
                        {passwordMode === "signin" && (
                          <button
                            type="button"
                            onClick={() => {
                              setResetMode(true);
                              setResetSent(false);
                              setResetError(null);
                            }}
                            className="font-body text-stock-500 underline decoration-dotted underline-offset-4 hover:text-ink"
                          >
                            Ai uitat parola?
                          </button>
                        )}
                      </div>
                    </form>
                  ))}
              </>
            )}
          </div>

          <p className="font-body mt-6 text-center text-xs leading-relaxed text-stock-500">
            Cifrele agregate de piață rămân publice —{" "}
            <Link href="/analysis" className="underline decoration-editorial decoration-2 underline-offset-4">
              vezi analiza fără cont
            </Link>
            .
          </p>
          <p className="font-body mt-2 text-center text-xs leading-relaxed text-stock-400">
            Prin autentificare sunteți de acord cu{" "}
            <Link href="/terms" className="underline decoration-editorial decoration-2 underline-offset-4">
              Termenii și Condițiile
            </Link>{" "}
            și{" "}
            <Link href="/privacy" className="underline decoration-editorial decoration-2 underline-offset-4">
              Politica de Confidențialitate
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
