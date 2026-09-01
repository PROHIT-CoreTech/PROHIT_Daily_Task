import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 20000,
    // DB-touching tests share one Mongo connection and a test-only database
    // (dropped between files) — run files serially to avoid cross-file
    // collection races on that shared connection.
    fileParallelism: false,
    env: {
      // Separate database from dev — never touch real dev/prod data.
      MONGODB_URI: "mongodb://127.0.0.1:27017/prohit_daily_task_test",
      NEXTAUTH_SECRET: "test-secret-do-not-use-in-production",
      NEXTAUTH_URL: "http://localhost:3000",
      RAZORPAY_WEBHOOK_SECRET: "test-webhook-secret",
      // The Razorpay SDK throws at construction time if key_id is empty —
      // razorpay.ts instantiates a client at module scope, so any test
      // that imports it (even indirectly) needs a non-empty placeholder.
      RAZORPAY_KEY_ID: "rzp_test_placeholder",
      RAZORPAY_KEY_SECRET: "test-key-secret",
    },
  },
});
