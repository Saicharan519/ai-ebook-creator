import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./lib/env";
import { createLlmProvider, type LlmProvider } from "./lib/llm";
import { logger } from "./lib/logger";
import { storage } from "./lib/storage";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { requireAuth } from "./middleware/require-auth";
import { aiUsageRouter, createAiRouter } from "./modules/ai/ai.routes";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { booksRouter } from "./modules/books/books.routes";
import { createChaptersRouter } from "./modules/chapters/chapters.routes";
import { exportRouter } from "./modules/export/export.routes";
import { noopMemoryQueue, type MemoryQueue } from "./modules/memory/memory-queue";
import { createStoryBibleRouter } from "./modules/memory/story-bible.routes";
import { healthRouter } from "./modules/health/health.routes";

export interface AppOptions {
  /** Overrides AUTH_RATE_LIMIT_MAX; lets tests exercise the limiter quickly. */
  authRateLimitMax?: number;
  /** Overrides the configured AI provider; tests pass a fake, or null for "not configured". */
  llm?: LlmProvider | null;
  /** Where Story Memory updates are scheduled; the server passes the real job queue */
  memoryQueue?: MemoryQueue;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  app.disable("x-powered-by");
  if (env.NODE_ENV === "production") {
    // Render puts one proxy in front of the app; needed for real client IPs in rate limiting
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // Uploaded covers are public, with unguessable names. The web app is on another
  // origin, so relax helmet's same-origin resource policy for these files only.
  app.use(
    "/uploads",
    express.static(storage.rootDir, {
      immutable: true,
      maxAge: "365d",
      setHeaders: (res) => res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"),
    }),
  );

  app.use("/health", healthRouter);
  app.use(
    "/auth",
    createAuthRouter({ rateLimitMax: options.authRateLimitMax ?? env.AUTH_RATE_LIMIT_MAX }),
  );
  const llm = options.llm === undefined ? createLlmProvider() : options.llm;
  const memoryQueue = options.memoryQueue ?? noopMemoryQueue;
  app.use(
    "/books",
    requireAuth,
    booksRouter,
    createChaptersRouter(memoryQueue),
    exportRouter,
    createAiRouter(llm),
    createStoryBibleRouter(memoryQueue, llm !== null),
  );
  app.use("/ai", requireAuth, aiUsageRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
