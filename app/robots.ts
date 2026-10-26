import type { MetadataRoute } from "next";

/** Public pages are indexed; the signed-in workspace and auth flows are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/analysis", "/terms", "/privacy", "/login"],
        disallow: ["/auth/", "/cautare-avansata", "/pipeline", "/drafting", "/eligibility", "/analytics", "/abonament", "/suport", "/crm"],
      },
    ],
    sitemap: "https://ro-intel.xyz/sitemap.xml",
    host: "https://ro-intel.xyz",
  };
}
