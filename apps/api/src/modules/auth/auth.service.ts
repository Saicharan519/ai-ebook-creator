import { randomUUID } from "node:crypto";
import type { LoginInput, RegisterInput, User } from "@ebook/shared";
import bcrypt from "bcryptjs";
import type { User as UserRow } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { env } from "../../lib/env";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import {
  REFRESH_TOKEN_TTL_MS,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from "./tokens";

// Low cost in tests keeps the suite fast; hashing strength is not what tests check
const BCRYPT_ROUNDS = env.NODE_ENV === "test" ? 4 : 12;

// Compared against when the email doesn't exist, so a login for an unknown
// email takes as long as one with a wrong password (no account enumeration)
const DUMMY_HASH = bcrypt.hashSync("dummy-password", BCRYPT_ROUNDS);

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export function toUserDto(user: UserRow): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    },
  });

  return startSession(user, randomUUID());
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    throw new UnauthorizedError("Incorrect email or password");
  }

  return startSession(user, randomUUID());
}

/**
 * Exchanges a refresh token for a new access token and a new refresh token.
 * Each refresh token works once. If an already-used token comes back, someone
 * else has a copy of it, so every session from that login is revoked.
 */
export async function refresh(refreshToken: string): Promise<AuthResult> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    include: { user: true },
  });

  if (!session) {
    throw new UnauthorizedError("Session not found");
  }

  if (session.revokedAt) {
    await revokeFamily(session.familyId);
    logger.warn({ userId: session.userId }, "Refresh token reuse detected; session family revoked");
    throw new UnauthorizedError("Session is no longer valid");
  }

  if (session.expiresAt <= new Date()) {
    throw new UnauthorizedError("Session expired");
  }

  // Conditional update so two simultaneous refreshes can't both succeed
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) {
    await revokeFamily(session.familyId);
    throw new UnauthorizedError("Session is no longer valid");
  }

  return startSession(session.user, session.familyId);
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutEverywhere(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUser(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return toUserDto(user);
}

async function startSession(user: UserRow, familyId: string): Promise<AuthResult> {
  const refreshToken = generateRefreshToken();

  await prisma.session.create({
    data: {
      userId: user.id,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return {
    accessToken: await signAccessToken(user.id),
    refreshToken,
    user: toUserDto(user),
  };
}

async function revokeFamily(familyId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
