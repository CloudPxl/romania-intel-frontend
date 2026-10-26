import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const isDev = process.env.NODE_ENV === "development";

// The app loads nothing third-party in the browser: fonts are self-hosted
// (next/font), and the only origins it talks to are the API and Supabase
// Auth. 'unsafe-inline' scripts are Next's own bootstrap and the theme
// script in app/layout.tsx (nonces would force every page dynamic; see
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// Images allow https: for Google profile pictures.
const SUPABASE = "https://upzyczsfizenlogkfvsa.supabase.co";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // localhost:8000 is the API when the site itself runs on localhost
  // (lib/api.ts:getApiBase) — the visitor's own machine, not a channel out.
  `connect-src 'self' https://api.ro-intel.xyz ${SUPABASE} ${SUPABASE.replace("https://", "wss://")} http://localhost:8000 http://127.0.0.1:8000${isDev ? " ws://localhost:*" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The deploy builds into .next-staging while the live server keeps
  // serving .next, then swaps the two directories (scripts/deploy-build.sh).
  // `next start` always runs without NEXT_DIST_DIR, so it reads .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // No "X-Powered-By: Next.js" advertising the framework and its version.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // This app is a git submodule inside a larger monorepo, so Turbopack was
  // walking up past the submodule boundary and picking up the parent's
  // package-lock.json. Pin the root to this directory.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  // `typescript.ignoreBuildErrors: true` used to sit here, which meant
  // `npm run build` reported success while type errors went straight to
  // production — the build was not actually verifying anything. Type
  // errors now fail the build, which is the point of having them.
  images: {
    unoptimized: true,
  },
  // "Registrul zilnic" was renamed "Căutare avansată" (the page grew real
  // filters and became a search surface, not a passive daily list) and its
  // URL moved with it. Anyone with an old bookmark or a link from before
  // the rename still lands somewhere real rather than a 404.
  async redirects() {
    return [
      { source: "/newsletter", destination: "/cautare-avansata", permanent: true },
      // "CRM" is what bidders call the bid pipeline; the route is /pipeline.
      // Query strings (?source_id=…) carry over.
      { source: "/crm", destination: "/pipeline", permanent: true },
    ];
  },
};

export default nextConfig;
