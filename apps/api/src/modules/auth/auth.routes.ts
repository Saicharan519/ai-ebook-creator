import { loginInputSchema, registerInputSchema, type AuthResponse } from "@ebook/shared";
import { Router, type CookieOptions, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../../lib/env";
import { AppError, UnauthorizedError } from "../../lib/errors";
import { currentUserId, requireAuth } from "../../middleware/require-auth";
import * as authService from "./auth.service";
import { REFRESH_TOKEN_TTL_MS } from "./tokens";

const REFRESH_COOKIE = "refresh_token";

// In production the web app proxies /api to this server, so the cookie is first-party
// (browsers increasingly block third-party cookies) and lives under /api/auth.
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production" || env.AUTH_COOKIE_SAMESITE === "none",
  sameSite: env.AUTH_COOKIE_SAMESITE,
  path: env.AUTH_COOKIE_PATH,
};

/**
 * Cookie-authenticated routes need a custom header. Browsers only let a page
 * on another site send custom headers if CORS allows it, which blocks CSRF.
 */
const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (req.get("X-Requested-With") !== "fetch") {
    throw new AppError(403, "CSRF_CHECK_FAILED", "Missing X-Requested-With header");
  }
  next();
};

function sendAuth(res: Response, status: number, result: authService.AuthResult) {
  res.cookie(REFRESH_COOKIE, result.refreshToken, {
    ...refreshCookieOptions,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
  const body: AuthResponse = { accessToken: result.accessToken, user: result.user };
  res.status(status).json(body);
}

function readRefreshCookie(cookies: unknown): string | undefined {
  const value = (cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function createAuthRouter({ rateLimitMax }: { rateLimitMax: number }) {
  const router = Router();

  const credentialsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: rateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(429, "TOO_MANY_REQUESTS", "Too many attempts. Try again later."));
    },
  });

  router.post("/register", credentialsLimiter, async (req, res) => {
    const input = registerInputSchema.parse(req.body);
    sendAuth(res, 201, await authService.register(input));
  });

  router.post("/login", credentialsLimiter, async (req, res) => {
    const input = loginInputSchema.parse(req.body);
    sendAuth(res, 200, await authService.login(input));
  });

  router.post("/refresh", requireCsrfHeader, async (req, res) => {
    const token = readRefreshCookie(req.cookies);
    if (!token) {
      throw new UnauthorizedError("No session");
    }
    try {
      sendAuth(res, 200, await authService.refresh(token));
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
      throw error;
    }
  });

  router.post("/logout", requireCsrfHeader, async (req, res) => {
    const token = readRefreshCookie(req.cookies);
    if (token) {
      await authService.logout(token);
    }
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    res.status(204).end();
  });

  router.post("/logout-all", requireAuth, async (req, res) => {
    await authService.logoutEverywhere(currentUserId(req));
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    res.status(204).end();
  });

  router.get("/me", requireAuth, async (req, res) => {
    res.json(await authService.getUser(currentUserId(req)));
  });

  return router;
}
