import type { Request, RequestHandler } from "express";
import { UnauthorizedError } from "../lib/errors";
import { verifyAccessToken } from "../modules/auth/tokens";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new UnauthorizedError();
  }

  req.auth = { userId: await verifyAccessToken(token) };
  next();
};

/** The authenticated user's id. Only call this in routes behind requireAuth. */
export function currentUserId(req: Request): string {
  if (!req.auth) {
    throw new UnauthorizedError();
  }
  return req.auth.userId;
}
