import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  ApiRequestError,
  onSessionExpired,
  refreshSession,
  setAccessToken,
} from "./api";

const session = {
  accessToken: "new-token",
  user: {
    id: "0190a0b0-0000-7000-8000-000000000001",
    name: "Asha",
    email: "asha@example.com",
    createdAt: new Date().toISOString(),
  },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  setAccessToken("old-token");
});

afterEach(() => {
  setAccessToken(null);
  onSessionExpired(null);
});

const authHeader = (call: number) =>
  (fetchMock.mock.calls[call]![1] as RequestInit).headers instanceof Headers
    ? ((fetchMock.mock.calls[call]![1] as RequestInit).headers as Headers).get("Authorization")
    : null;

describe("apiRequest", () => {
  it("sends the access token and the CSRF header, and validates the response", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await expect(apiRequest("/thing", z.object({ ok: z.boolean() }))).resolves.toEqual({
      ok: true,
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/thing$/);
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer old-token");
    expect(headers.get("X-Requested-With")).toBe("fetch");
    expect((init as RequestInit).credentials).toBe("include");
  });

  it("refreshes an expired token once and retries the request", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: "UNAUTHORIZED", message: "expired" } }))
      .mockResolvedValueOnce(json(200, session))
      .mockResolvedValueOnce(json(200, { ok: true }));

    await expect(apiRequest("/thing", z.object({ ok: z.boolean() }))).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock.mock.calls[1]![0]).toMatch(/\/auth\/refresh$/);
    expect(authHeader(2)).toBe("Bearer new-token");
  });

  it("reports an expired session when the refresh fails too", async () => {
    const expired = vi.fn();
    onSessionExpired(expired);
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: "UNAUTHORIZED", message: "expired" } }))
      .mockResolvedValueOnce(json(401, { error: { code: "UNAUTHORIZED", message: "no session" } }));

    await expect(apiRequest("/thing", z.unknown())).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });

  it("does not try to refresh when told not to (e.g. a wrong password)", async () => {
    fetchMock.mockResolvedValueOnce(
      json(401, { error: { code: "UNAUTHORIZED", message: "Incorrect email or password" } }),
    );

    const request = apiRequest("/auth/login", z.unknown(), { refreshOnUnauthorized: false });

    await expect(request).rejects.toBeInstanceOf(ApiRequestError);
    await expect(request).rejects.toHaveProperty("message", "Incorrect email or password");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("turns API errors into ApiRequestError with code and details", async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, { error: { code: "VALIDATION_ERROR", message: "Invalid", details: { a: 1 } } }),
    );

    await expect(apiRequest("/thing", z.unknown())).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      details: { a: 1 },
    });
  });
});

describe("refreshSession", () => {
  it("shares one request between concurrent callers", async () => {
    fetchMock.mockResolvedValueOnce(json(200, session));

    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(a).toEqual(session);
    expect(b).toEqual(session);
  });

  it("returns null when the server is unreachable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(refreshSession()).resolves.toBeNull();
  });
});
