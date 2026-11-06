import type { Metadata } from "next";

/**
 * The operations console. Not linked from any navigation, not in the
 * sitemap, and deliberately NOT in robots.ts (a public disallow list would
 * announce it). Search engines are told not to index or follow it here;
 * access itself is decided by the API, never by this file.
 */
export const metadata: Metadata = {
  // Neutral on purpose: the title is served before the API has said whether
  // the caller is staff, and a non-staff visitor sees the normal 404.
  title: { absolute: "RO-INTEL" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
