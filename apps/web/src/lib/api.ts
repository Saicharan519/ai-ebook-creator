import { apiErrorSchema } from "@ebook/shared";
import type { z } from "zod";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** An error response from the API, with the code and message it sent. */
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/**
 * Calls the API and validates the response against `schema`, so a
 * mismatch between frontend and backend fails loudly instead of silently.
 */
export async function apiRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<z.infer<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw parsed.success
      ? new ApiRequestError(res.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiRequestError(res.status, "UNKNOWN", `Request failed with status ${res.status}`);
  }

  return schema.parse(body);
}
