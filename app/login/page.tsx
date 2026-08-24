"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Mail, Sparkles, Building2 } from "lucide-react";

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, user } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user) router.push("/");
  }, [user, router]);

  if (user) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await signInWithEmail(email);
      setSent(true);
    } catch (err: any) {
      alert(err.message || "Eroare la autentificare");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111624] border border-zinc-800/80 rounded-2xl p-8 shadow-2xl relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
            <Building2 className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">RO-INTEL Desk</h1>
            <p className="text-xs text-zinc-400">Intelligence Comerciala & Ofertare B2B</p>
          </div>
        </div>

        <button
          onClick={() => signInWithGoogle()}
          className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 text-sm font-medium rounded-xl border border-zinc-700/60 flex items-center justify-center gap-3 mb-5 transition cursor-pointer"
        >
          Continuă cu Google
        </button>

        {sent ? (
          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-center">
            <Sparkles className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <p className="text-xs text-zinc-200">Link de autentificare trimis la: <span className="text-cyan-400 font-mono">{email}</span></p>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email Profesional</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nume@companie.ro"
                required
                className="w-full h-11 bg-zinc-900/90 border border-zinc-800 rounded-xl px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/60"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? "Se trimite..." : "Trimite Magic Link"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
