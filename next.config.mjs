import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ];
  },
};

export default nextConfig;
