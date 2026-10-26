import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: process.env.NODE_ENV === "test" ? ".env.test" : ".env", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Not needed for `prisma generate`, so a fresh clone can install without a .env
    url: process.env.DATABASE_URL ?? "",
  },
});
