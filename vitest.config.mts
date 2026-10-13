import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    // `.claude/worktrees` holds git worktrees of this same repo, whose tests would otherwise run twice.
    exclude: ["node_modules", ".next", ".claude/worktrees"],
  },
});
