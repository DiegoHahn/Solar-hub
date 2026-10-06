import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
  {
    files: ["**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      // Test mocks and fixtures handle raw payloads from Supabase / external APIs
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
