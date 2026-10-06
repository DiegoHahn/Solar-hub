import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/**/*.integration.test.{ts,tsx}", "node_modules/**"],
    // Dates are formatted in America/Sao_Paulo; pin timezone for deterministic tests across any machine/CI
    env: { TZ: "America/Sao_Paulo" },
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/components/**"],
      exclude: [
        "src/lib/supabase/**",
        "src/lib/supabase.ts",
        "src/lib/types.ts",
        "src/lib/database.types.ts",
        "src/lib/demo/data/**",
      ],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
