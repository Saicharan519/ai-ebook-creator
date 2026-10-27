import { config } from "dotenv";
import { z } from "zod";

config({ path: process.env.NODE_ENV === "test" ? ".env.test" : ".env", quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.url(),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((origin) => origin.trim())),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  JWT_ACCESS_SECRET: z.string().min(32, "must be at least 32 characters"),
  // Login/register attempts allowed per IP in a 15-minute window
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  // Proxies between the internet and this app, so rate limits see real client IPs.
  // Render alone is 1; Vercel's /api proxy in front of Render makes it 2.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  // Where the browser sends the refresh cookie. Behind the /api proxy this is /api/auth.
  AUTH_COOKIE_PATH: z.string().startsWith("/").default("/auth"),
  // "lax" when the web app and API share a site (locally, or through the /api proxy);
  // "none" only if they are served from different sites
  AUTH_COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  // Public base URL of this API; used to build links to uploaded files
  PUBLIC_API_URL: z.url().default("http://localhost:8000"),
  // "disk" keeps uploads in UPLOAD_DIR; "database" keeps them in Postgres (for hosts
  // whose disk is wiped on restart, like Render's free tier)
  STORAGE_DRIVER: z.enum(["disk", "database"]).default("disk"),
  // Folder for uploaded files, relative to apps/api
  UPLOAD_DIR: z.string().min(1).default("uploads"),
  // "fake" streams placeholder text: for tests and for trying the app without an API key
  AI_PROVIDER: z.enum(["gemini", "fake"]).default("gemini"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-3.6-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().min(1).default("gemini-embedding-001"),
  // Cheaper, faster model for background Story Memory work (separate quota from writing)
  GEMINI_MEMORY_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
  // Story Memory waits this long after the last edit before re-reading a chapter
  MEMORY_DEBOUNCE_SECONDS: z.coerce.number().int().positive().default(30),
  // Input + output tokens one user may spend per UTC day
  AI_DAILY_TOKEN_LIMIT: z.coerce.number().int().positive().default(200_000),
  AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),
  // All requests from one IP address, per minute
  GLOBAL_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

/** Validates environment variables; throws with every problem listed if any are wrong. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
