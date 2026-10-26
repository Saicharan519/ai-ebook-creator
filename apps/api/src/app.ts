import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { healthRouter } from "./modules/health/health.routes";

export interface AppOptions {
  /** Overrides AUTH_RATE_LIMIT_MAX; lets tests exercise the limiter quickly. */
  authRateLimitMax?: number;
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

  app.use("/health", healthRouter);
  app.use(
    "/auth",
    createAuthRouter({ rateLimitMax: options.authRateLimitMax ?? env.AUTH_RATE_LIMIT_MAX }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
