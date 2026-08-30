import type { Metadata, Viewport } from "next";
import { Playfair_Display, Lora, Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import NavBar from "@/components/NavBar";
import "./globals.css";

// Loaded through next/font rather than an @import so the faces are
// self-hosted and preloaded — a webfont fetched at parse time would flash
// a fallback serif across every headline on first paint.
const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
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
  themeColor: "#f9f9f7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ro"
      className={`${playfair.variable} ${lora.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>
        <AuthProvider>
          <div className="flex min-h-svh flex-col">
            <NavBar />
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
