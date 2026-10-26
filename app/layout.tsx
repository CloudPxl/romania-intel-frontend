import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { CompanyProfileProvider } from "@/context/CompanyProfileContext";
import { CopilotProvider } from "@/context/CopilotContext";
import { ThemeProvider } from "@/context/ThemeContext";
import AppShell from "@/components/AppShell";
import InstallPrompt from "@/components/InstallPrompt";
import CopilotWidget from "@/components/CopilotWidget";
import "./globals.css";

// Runs before React hydrates, same mechanism next-themes uses, so a
// returning user who picked dark mode never sees a flash of the light
// theme on load. Kept as a literal string (not a shared constant with
// ThemeContext.tsx) because it has to be inlined into the HTML as-is —
// importing it would pull a module graph into a plain <script> tag.
// It also marks <html data-session> when a Supabase session is stored, so
// the public landing page is not flashed at a signed-in user while the
// client resolves the session (components/AppShell.tsx clears it).
const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;try{if(localStorage.getItem('ro_intel_theme')==='dark'){d.setAttribute('data-theme','dark');}for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||'';if(k.indexOf('sb-')===0&&k.slice(-11)==='-auth-token'){d.setAttribute('data-session','1');break;}}}catch(e){}})();`;

// Two families only (design system): Geist for text, Geist Mono with
// tabular figures for numbers, CPV, CUI and articles of law.
const geist = Geist({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RO-INTEL — Registrul Oportunităților Publice",
  description:
    "Intelligence pre-SEAP pentru achiziții publice din România: flux zilnic de oportunități calificate, analiză de piață, generare documente și pipeline de ofertare.",
  applicationName: "RO-INTEL",
  // Drives the iOS Home Screen tile and standalone status bar. Safari
  // still reads these meta tags rather than the manifest for both.
  appleWebApp: {
    capable: true,
    title: "RO-INTEL",
    statusBarStyle: "default",
  },
  formatDetection: {
    // Stops iOS turning CUIs, notice numbers and RON figures into blue
    // "call this number" links throughout the feed.
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // Without this, iOS screenshots the page for the Home Screen tile
    // instead of using the app mark — and the Home Screen install is the
    // only route to Web Push on iPhone, so it is the first thing a user
    // sees of the feature.
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    // Next 16 emits the modern `mobile-web-app-capable`, which iOS has only
    // honoured since 15.4. The legacy Apple-prefixed tag is still what
    // older iPhones read, and a device that ignores it opens the installed
    // icon in a normal Safari tab — where Web Push does not exist.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fafaf7",
  // Lets the app paint into the notch/home-indicator area when installed;
  // components that sit at the edges pay for it back with env(safe-area-*).
  viewportFit: "cover",
  // Deliberately NOT maximumScale/userScalable — pinch-zoom is an
  // accessibility affordance, and disabling it to stop iOS focus-zoom is
  // trading a real need for a cosmetic one. The 16px minimum font size on
  // inputs (globals.css) is what actually prevents that zoom.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
          <CompanyProfileProvider>
          <CopilotProvider>
            <AppShell>{children}</AppShell>
            {/* iOS-only, dismissible: Apple permits Web Push solely from an
                installed PWA, so on iPhone this is the path to notifications
                working at all. Renders nothing anywhere else. */}
            <InstallPrompt />
            {/* Signed-in pages only; renders nothing on /login and /auth. */}
            <CopilotWidget />
          </CopilotProvider>
          </CompanyProfileProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
