import { authResponseSchema, type AuthResponse } from "@ebook/shared";
import type { Express } from "express";
import request from "supertest";
import { prisma } from "../src/lib/db";

/** Empties every table so each test starts from a clean database. */
export async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const names = tables.map(({ tablename }) => `"${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${names} CASCADE`);
}

let userCounter = 0;

export interface TestUser extends AuthResponse {
  /** "refresh_token=..." ready to send as a Cookie header */
  cookie: string;
  password: string;
}

/** Registers a new user through the API and returns their tokens. */
export async function createUser(
  app: Express,
  overrides: { name?: string; email?: string; password?: string } = {},
): Promise<TestUser> {
  userCounter += 1;
  const input = {
    name: overrides.name ?? `Writer ${userCounter}`,
    email: overrides.email ?? `writer${userCounter}-${Date.now()}@example.com`,
    password: overrides.password ?? "correct horse battery",
  };

  const res = await request(app).post("/auth/register").send(input).expect(201);
  return {
    ...authResponseSchema.parse(res.body),
    cookie: refreshCookieFrom(res),
    password: input.password,
  };
}

/** Pulls "refresh_token=<value>" out of a response's Set-Cookie headers. */
export function refreshCookieFrom(res: request.Response): string {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = header?.find((value) => value.startsWith("refresh_token="));
  if (!cookie) {
    throw new Error("Response did not set a refresh_token cookie");
  }
  return cookie.split(";")[0]!;
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}
