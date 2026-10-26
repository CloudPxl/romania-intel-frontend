import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { FAQ } from "@/components/landing/content";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * Structured data for search and answer engines: what RO-INTEL is, its
 * three plans at their real prices, and the landing page's FAQ verbatim
 * (components/landing/content.ts). Nothing here that the page does not say.
 */
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RO-INTEL",
    url: "https://ro-intel.xyz",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "ro-RO",
    description:
      "Monitorizare licitații publice SEAP/SICAP pentru firmele din România: alerte după CPV, județ și valoare, scanarea caietului de sarcini pentru clauze restrictive, calculul pragului de 80% (art. 210 Legea 98/2016, art. 136 HG 395/2016) și redactarea clarificărilor și a propunerii tehnice.",
    offers: PLANS.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: String(p.monthly),
      priceCurrency: "RON",
      description: p.pitch,
    })),
    publisher: { "@type": "Organization", name: "RO-INTEL", url: "https://ro-intel.xyz", areaServed: "RO" },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
];

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }} />
      <HomeClient />
    </>
  );
}
