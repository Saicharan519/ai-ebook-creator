import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../../lib/env";
import { UnauthorizedError } from "../../lib/errors";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

/** Returns the user id from a valid access token, or throws UnauthorizedError. */
export async function verifyAccessToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.sub) throw new Error("Token has no subject");
    return payload.sub;
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

/** Refresh tokens are random, not JWTs: the database is the source of truth for them. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the hash is stored, so a database leak doesn't hand out usable tokens. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
