import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent scratch. `.superpowers/` holds per-plan SDD workspaces (briefs,
    // reports, review packages, file snapshots) plus tooling that is CommonJS
    // by design. Linting them made `npm run lint` exit 1 on errors that are not
    // the application's, breaking the project's own lint gate.
    ".superpowers/**",
  ]),
]);

export default eslintConfig;
