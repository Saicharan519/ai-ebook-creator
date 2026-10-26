import { apiErrorSchema, authResponseSchema, type AuthResponse } from "@ebook/shared";
import type { z } from "zod";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** An error response from the API, with the code and message it sent. */
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

// The access token lives only in memory: unlike localStorage, a script injected
// into the page can't read it later. The refresh token is an httpOnly cookie.
let accessToken: string | null = null;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Called when a request fails with 401 and the session can't be refreshed. */
export function onSessionExpired(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Sent as a JSON body */
  json?: unknown;
  body?: BodyInit;
  /** Set false for login/register, where 401 means "wrong password", not "token expired" */
  refreshOnUnauthorized?: boolean;
}

function send(path: string, { json, body, headers: extraHeaders, ...init }: RequestOptions = {}) {
  const headers = new Headers(extraHeaders);
  // Required by the API on cookie-authenticated routes (CSRF protection)
  headers.set("X-Requested-With", "fetch");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    body: json !== undefined ? JSON.stringify(json) : body,
    credentials: "include",
  });
}

/**
 * Trades the refresh cookie for a new access token. Concurrent callers share
 * one request: the API rotates refresh tokens and treats a reused one as theft,
 * so two parallel refreshes would log the user out.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await send("/auth/refresh", { method: "POST" });
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const session = authResponseSchema.parse(await res.json());
      accessToken = session.accessToken;
      return session;
    } catch {
      accessToken = null;
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function toApiError(res: Response): Promise<ApiRequestError> {
  const body: unknown = await res.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);
  return parsed.success
    ? new ApiRequestError(
        res.status,
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.details,
      )
    : new ApiRequestError(res.status, "UNKNOWN", `Request failed with status ${res.status}`);
}

/** Sends a request; on 401 refreshes the session once and retries. Throws ApiRequestError. */
async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  let res = await send(path, options);

  if (res.status === 401 && options.refreshOnUnauthorized !== false) {
    if (await refreshSession()) {
      res = await send(path, options);
    } else {
      sessionExpiredHandler?.();
    }
  }

  if (!res.ok) {
    throw await toApiError(res);
  }
  return res;
}

/**
 * Calls the API and validates the JSON response against `schema`, so a
 * mismatch between frontend and backend fails loudly instead of silently.
 */
export async function apiRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  options?: RequestOptions,
): Promise<z.infer<T>> {
  const res = await request(path, options);
  return schema.parse(await res.json());
}

/** For requests whose response has no body (e.g. 204 No Content). */
export async function apiSend(path: string, options?: RequestOptions): Promise<void> {
  await request(path, options);
}

/** For file downloads. */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await request(path);
  return res.blob();
}

/** For streamed responses: returns the raw Response so the body can be read as it arrives. */
export function apiStream(path: string, options?: RequestOptions): Promise<Response> {
  return request(path, options);
}
