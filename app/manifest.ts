import type { MetadataRoute } from "next";

/**
 * Web App Manifest — what makes RO-INTEL installable.
 *
 * This is not cosmetic on iOS: Safari only permits Web Push for a site the
 * user has added to the Home Screen and that declares
 * `display: "standalone"`. Without this file, the notification toggle can
 * never work on iPhone at all, no matter what the backend does — which is
 * also why components/InstallPrompt.tsx exists to explain that.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RO-INTEL — Registrul Oportunităților Publice",
    short_name: "RO-INTEL",
    description:
      "Intelligence pre-SEAP pentru achiziții publice din România: oportunități calificate, analiză de piață și alerte în timp real.",
    lang: "ro",
    start_url: "/",
    // Where a notification click lands the app when it was cold-started.
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    // Matches --color-paper, so the splash screen and the OS chrome are
    // the same surface the app itself is built on rather than flashing
    // white before first paint.
    background_color: "#e0e5ec",
    theme_color: "#e0e5ec",
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops icons to whatever shape the launcher uses. A
      // "maskable" variant bleeds to the edges so that crop never cuts
      // into the glyph or exposes transparent corners.
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Căutare avansată", short_name: "Căutare", url: "/cautare-avansata" },
      { name: "Analiza de piață", short_name: "Analiză", url: "/analysis" },
      { name: "Pipeline ofertare", short_name: "Pipeline", url: "/pipeline" },
    ],
  };
}
