import { apiErrorSchema, authResponseSchema } from "@ebook/shared";
import { SignJWT } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/db";
import { env } from "../src/lib/env";
import { bearer, createUser, refreshCookieFrom, resetDatabase } from "./helpers";

const app = createApp();
const CSRF = { "X-Requested-With": "fetch" };

beforeEach(resetDatabase);

describe("POST /auth/register", () => {
  it("creates the user, returns an access token, and sets an httpOnly refresh cookie", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Asha", email: "Asha@Example.com", password: "long enough pw" });

    expect(res.status).toBe(201);
    const body = authResponseSchema.parse(res.body);
    expect(body.user).toMatchObject({ name: "Asha", email: "asha@example.com" });
    expect(JSON.stringify(res.body)).not.toContain("password");

    const cookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cookie).toContain("refresh_token=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/auth");
  });

  it("stores a bcrypt hash, never the plain password", async () => {
    await createUser(app, { email: "hash@example.com", password: "plain text pw" });

    const row = await prisma.user.findUniqueOrThrow({ where: { email: "hash@example.com" } });
    expect(row.passwordHash).not.toBe("plain text pw");
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("rejects a second account with the same email, ignoring case", async () => {
    await createUser(app, { email: "dup@example.com" });

    const res = await request(app)
      .post("/auth/register")
      .send({ name: "Copy", email: "DUP@example.com", password: "another password" });

    expect(res.status).toBe(409);
    expect(apiErrorSchema.parse(res.body).error.code).toBe("CONFLICT");
  });

  it("validates the input and reports each bad field", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ name: "", email: "not-an-email", password: "short" });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual([
      "email",
      "name",
      "password",
    ]);
  });
});

describe("POST /auth/login", () => {
  it("logs in with the right password", async () => {
    const user = await createUser(app, { email: "login@example.com" });

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "login@example.com", password: user.password });

    expect(res.status).toBe(200);
    expect(authResponseSchema.parse(res.body).user.id).toBe(user.user.id);
    expect(refreshCookieFrom(res)).toMatch(/^refresh_token=.+/);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await createUser(app, { email: "known@example.com" });

    const wrongPassword = await request(app)
      .post("/auth/login")
      .send({ email: "known@example.com", password: "wrong password" });
    const unknownEmail = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@example.com", password: "wrong password" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it("is rate limited", async () => {
    const limitedApp = createApp({ authRateLimitMax: 3 });
    const attempt = () =>
      request(limitedApp).post("/auth/login").send({ email: "x@example.com", password: "nope" });

    for (let i = 0; i < 3; i++) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("TOO_MANY_REQUESTS");
  });
});

describe("GET /auth/me", () => {
  it("returns the current user for a valid access token", async () => {
    const user = await createUser(app);

    const res = await request(app).get("/auth/me").set(bearer(user.accessToken));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(user.user);
  });

  it("rejects missing, malformed, and expired tokens", async () => {
    const user = await createUser(app);
    const expired = await new SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.user.id)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));

    expect((await request(app).get("/auth/me")).status).toBe(401);
    expect((await request(app).get("/auth/me").set(bearer("garbage"))).status).toBe(401);
    expect((await request(app).get("/auth/me").set(bearer(expired))).status).toBe(401);
  });

  it("rejects a token signed with a different secret", async () => {
    const user = await createUser(app);
    const forged = await new SignJWT()
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.user.id)
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("a-different-secret-that-is-32-chars-long"));

    expect((await request(app).get("/auth/me").set(bearer(forged))).status).toBe(401);
  });
});

describe("POST /auth/refresh", () => {
  it("issues new tokens and rotates the refresh cookie", async () => {
    const user = await createUser(app);

    const res = await request(app).post("/auth/refresh").set(CSRF).set("Cookie", user.cookie);

    expect(res.status).toBe(200);
    expect(authResponseSchema.parse(res.body).user.id).toBe(user.user.id);
    expect(refreshCookieFrom(res)).not.toBe(user.cookie);
  });

  it("detects reuse of an old refresh token and ends the whole session", async () => {
    const user = await createUser(app);
    const first = await request(app).post("/auth/refresh").set(CSRF).set("Cookie", user.cookie);
    const rotatedCookie = refreshCookieFrom(first);

    // An attacker replays the original (already used) token
    const replay = await request(app).post("/auth/refresh").set(CSRF).set("Cookie", user.cookie);
    expect(replay.status).toBe(401);

    // ...which also kills the legitimate user's newer token
    const legit = await request(app).post("/auth/refresh").set(CSRF).set("Cookie", rotatedCookie);
    expect(legit.status).toBe(401);
  });

  it("requires the CSRF header", async () => {
    const user = await createUser(app);

    const res = await request(app).post("/auth/refresh").set("Cookie", user.cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_CHECK_FAILED");
  });

  it("rejects requests without a cookie", async () => {
    const res = await request(app).post("/auth/refresh").set(CSRF);
    expect(res.status).toBe(401);
  });
});

describe("logout", () => {
  it("revokes the session and clears the cookie", async () => {
    const user = await createUser(app);

    const res = await request(app).post("/auth/logout").set(CSRF).set("Cookie", user.cookie);
    expect(res.status).toBe(204);
    expect((res.headers["set-cookie"] as unknown as string[]).join(";")).toMatch(/refresh_token=;/);

    const refresh = await request(app).post("/auth/refresh").set(CSRF).set("Cookie", user.cookie);
    expect(refresh.status).toBe(401);
  });

  it("can log out of every device at once", async () => {
    const user = await createUser(app);
    const otherDevice = await request(app)
      .post("/auth/login")
      .send({ email: user.user.email, password: user.password });
    const otherCookie = refreshCookieFrom(otherDevice);

    const res = await request(app).post("/auth/logout-all").set(bearer(user.accessToken));
    expect(res.status).toBe(204);

    for (const cookie of [user.cookie, otherCookie]) {
      const refresh = await request(app).post("/auth/refresh").set(CSRF).set("Cookie", cookie);
      expect(refresh.status).toBe(401);
    }
  });
});
