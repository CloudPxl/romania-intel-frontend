"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Mail, Sparkles, Building2 } from "lucide-react";

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, user } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (user) {
    router.push("/");
    return null;
  }

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
    <div className="min-h-screen bg-[#0a0d14] text-zinc-100 flex items-center justify-center p-4 selection:bg-cyan-500/20">
      <div className="w-full max-w-md bg-[#111622] border border-zinc-800/80 rounded-2xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
            <Building2 className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">RO-INTEL Desk</h1>
            <p className="text-xs text-zinc-400">Intelligence Comercială & Ofertare B2B</p>
          </div>
        </div>

        {/* Google OAuth */}
        <button
          onClick={() => signInWithGoogle()}
          className="w-full h-11 bg-zinc-900 hover:bg-zinc-800/80 text-zinc-100 text-sm font-medium rounded-xl border border-zinc-700/60 flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.99] mb-5 shadow-sm cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 8.9 5 12 5z" />
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8 0-1.3.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z" />
            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
          </svg>
          Continuă cu Google
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="h-px bg-zinc-800 flex-1" />
          <span className="text-[11px] text-zinc-500 uppercase tracking-widest font-mono">sau Magic Link</span>
          <div className="h-px bg-zinc-800 flex-1" />
        </div>

        {/* Magic Link */}
        {sent ? (
          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-center">
            <Sparkles className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <p className="text-xs text-zinc-200 font-medium">Link de autentificare trimis la:</p>
            <p className="text-xs text-cyan-400 font-mono mt-1">{email}</p>
            <p className="text-[11px] text-zinc-500 mt-2">Verificați căsuța de email pentru acces instant.</p>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email Profesional</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nume@companie.ro"
                  required
                  className="w-full h-11 bg-zinc-900/90 border border-zinc-800 rounded-xl pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors duration-150 shadow-md cursor-pointer"
            >
              {loading ? "Se trimite..." : "Trimite Magic Link"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Multi-Tenant & xAI Securizat</span>
          </div>
          <span>B2B România</span>
        </div>
      </div>
    </div>
  );
}
