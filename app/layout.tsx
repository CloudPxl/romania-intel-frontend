import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
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
          <div className="flex min-h-svh">
            <Sidebar />
            <div className="flex min-h-svh min-w-0 flex-1 flex-col">
              <Topbar />
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
