import type { MetadataRoute } from "next";

const BASE = "https://ro-intel.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/analysis`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
