import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Datas são formatadas em America/Sao_Paulo; fixa o fuso para testes determinísticos em qualquer máquina/CI
    env: { TZ: "America/Sao_Paulo" },
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/components/**"],
      exclude: ["src/lib/supabase/**", "src/lib/supabase.ts"],
      reporter: ["text", "html", "lcov"],
    },
  },
});
