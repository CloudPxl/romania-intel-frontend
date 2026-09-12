import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import InstallPrompt from "@/components/InstallPrompt";
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
  themeColor: "#e0e5ec",
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
          {/* iOS-only, dismissible: Apple permits Web Push solely from an
              installed PWA, so on iPhone this is the path to notifications
              working at all. Renders nothing anywhere else. */}
          <InstallPrompt />
        </AuthProvider>
      </body>
    </html>
  );
}
