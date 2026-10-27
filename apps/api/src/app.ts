import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { env } from "./lib/env";
import { createLlmProvider, type LlmProvider } from "./lib/llm";
import { AppError, NotFoundError } from "./lib/errors";
import { requestLogger } from "./lib/request-logger";
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
import { publicRouter } from "./modules/public/public.routes";
import { createVersionsRouter } from "./modules/versions/versions.routes";

/** Upload keys are made by the server (books.service setCover); nothing else is served */
const UPLOAD_KEY = /^covers\/[0-9a-f-]{36}\.(png|jpg)$/;

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
  if (env.TRUST_PROXY_HOPS > 0) {
    app.set("trust proxy", env.TRUST_PROXY_HOPS);
  }

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestLogger);
  // A ceiling for any one address, on top of the stricter limits on login, AI, and
  // the public reader. Generous enough that normal editing (autosave) never hits it.
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: env.GLOBAL_RATE_LIMIT_PER_MINUTE,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (req) => req.path === "/health",
      handler: (_req, _res, next) => {
        next(new AppError(429, "TOO_MANY_REQUESTS", "Too many requests. Slow down a little."));
      },
    }),
  );

  // Uploaded covers are public, with unguessable names that never change. The web
  // app may be on another origin, so relax helmet's same-origin resource policy here.
  app.get("/uploads/*key", async (req, res) => {
    const key = (req.params as { key: string[] }).key.join("/");
    const match = UPLOAD_KEY.exec(key);
    const data = match ? await storage.read(key) : null;
    if (!match || !data) throw new NotFoundError("File not found");
    res.set({
      "Content-Type": match[1] === "png" ? "image/png" : "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
    res.send(data);
  });

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
    createVersionsRouter(memoryQueue),
    exportRouter,
    createAiRouter(llm),
    createStoryBibleRouter(memoryQueue, llm !== null),
  );
  app.use("/ai", requireAuth, aiUsageRouter);
  // No login: published books only
  app.use("/public", publicRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
