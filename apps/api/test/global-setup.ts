import { execSync } from "node:child_process";

/** Bring the test database schema up to date before any test runs. */
export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "test" },
  });
}
