"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatDateline } from "@/lib/format";
import { Button, Eyebrow, Input, Notice } from "@/components/newsprint";

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateline, setDateline] = useState("");
  const router = useRouter();

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

  return (
    <main className="flex min-h-svh flex-col">
      <div className="mx-auto grid w-full max-w-screen-xl flex-1 grid-cols-1 lg:grid-cols-12">
        {/* Editorial column */}
        <section className="flex flex-col justify-center border-b border-ink px-4 py-10 sm:px-8 lg:col-span-7 lg:border-b-0 lg:border-r lg:py-16">
          <Eyebrow className="text-editorial">Intelligence achiziții publice · România</Eyebrow>
          <Link href="/" className="font-display mt-3 block text-5xl font-black leading-[0.88] tracking-tighter sm:text-7xl">
            RO<span className="text-editorial">·</span>INTEL
          </Link>
          <p className="font-mono mt-4 text-[11px] uppercase tracking-[0.2em] text-stock-500">
            {dateline || " "}
          </p>

          <p className="font-body drop-cap mt-8 max-w-xl text-base leading-relaxed text-stock-700">
            Contractele publice se decid înainte de a fi publicate. Registrul urmărește consultările de piață,
            anunțurile de intenție și registrele de investiții din România și le transformă în semnale calificate,
            cu mult înainte ca procedura să apară în SEAP.
          </p>

          <ul className="mt-8 max-w-xl border-t border-ink">
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
          <div className="border-4 border-ink p-5 sm:p-7">
            <Eyebrow className="text-editorial">Acces abonați</Eyebrow>
            <h2 className="font-display mt-2 text-3xl font-black leading-tight tracking-tight">Autentificare</h2>
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
                  <span className="label-eyebrow text-stock-400">sau magic link</span>
                  <span className="h-px flex-1 bg-divider" />
                </div>

                {sent ? (
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
                        placeholder="nume@companie.ro"
                        required
                        autoComplete="email"
                        inputMode="email"
                      />
                    </div>
                    <Button type="submit" disabled={submitting} fullWidth>
                      {submitting ? "Se trimite…" : "Trimite magic link"}
                    </Button>
                  </form>
                )}

                {error && (
                  <div className="mt-4">
                    <Notice tone="alert">{error}</Notice>
                  </div>
                )}
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
        </section>
      </div>
    </main>
  );
}
