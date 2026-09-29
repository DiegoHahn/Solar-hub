import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

function loadLocalEnv() {
  const envFiles = [".env.test.local", ".env.test", ".env.local"];
  const env: Record<string, string> = { TZ: "America/Sao_Paulo" };

  for (const file of envFiles) {
    const fullPath = path.resolve(import.meta.dirname, file);
    if (fs.existsSync(fullPath)) {
      const lines = fs.readFileSync(fullPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [k, ...v] = trimmed.split("=");
        const key = k.trim();
        if (!env[key]) {
          env[key] = v.join("=").trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  }
  return env;
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/test/integration/**/*.integration.test.ts"],
    testTimeout: 25000,
    hookTimeout: 25000,
    env: loadLocalEnv(),
    setupFiles: ["./src/test/integration/setup.ts"],
  },
});
