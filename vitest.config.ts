import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["server/**/*.test.ts", "client/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["server/game/**/*.ts", "server/socket/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.test.ts"],
    },
  },
});
