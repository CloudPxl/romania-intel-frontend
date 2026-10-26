import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Autentificare",
  description: "Intrați în contul RO-INTEL cu un link pe email sau cu Google. Contul gratuit se creează în câteva secunde, fără card.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
