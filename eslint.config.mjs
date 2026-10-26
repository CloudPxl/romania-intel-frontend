import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler advice against setting state synchronously in an
      // effect (an extra render). The pages load data with exactly that
      // pattern (setLoading(true); fetch…), 26 places at adoption; they are
      // reported, not failed, until the UI refactor replaces them.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Build outputs, including the deploy's staging and previous builds
  // (scripts/deploy-build.sh).
  globalIgnores([".next/**", ".next-staging/**", ".next-prev/**", ".next.swap/**", "out/**", "build/**", "next-env.d.ts"]),
]);
