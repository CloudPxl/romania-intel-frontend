import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RO-INTEL — Registrul Oportunităților Publice",
  description:
    "Intelligence pre-SEAP pentru achiziții publice din România: flux zilnic de oportunități calificate, analiză de piață, generare documente și pipeline de ofertare.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e0e5ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${jakarta.variable} ${dmSans.variable} ${jetbrains.variable}`}>
      <body>
        <AuthProvider>
          {/* Ambient colour behind everything. A real element rather than a
              body::before, so its stacking context is explicit: the shell
              below sits at z-10 and is never painted underneath it. */}
          <div className="mesh-layer" aria-hidden="true" />
          {/* flex-col below lg, flex-row from lg up.
              Sidebar renders a fragment: an <aside> (hidden below lg) AND a
              sticky mobile <header> (hidden from lg up). Both are direct
              children of this container, so with a plain `flex` the mobile
              header became a flex ROW item — a ~226px left-hand column that
              squeezed <main> into the remaining ~160px of a 390px phone,
              instead of the top bar it is styled to be. It only shows below
              lg, which is exactly where the row direction is wrong.
              min-h-svh lives here alone; a second one on the inner column
              would stack under the header and overflow the viewport. */}
          <div className="relative z-10 flex min-h-svh flex-col lg:flex-row">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">{children}</div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
