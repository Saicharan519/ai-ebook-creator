import { describe, expect, it } from "vitest";
import { apiErrorSchema, healthResponseSchema } from "./index";

describe("shared schemas", () => {
  it("accepts a valid health response", () => {
    const result = healthResponseSchema.safeParse({
      status: "ok",
      database: "up",
      uptimeSeconds: 12,
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown health status", () => {
    const result = healthResponseSchema.safeParse({
      status: "broken",
      database: "up",
      uptimeSeconds: 1,
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it("requires code and message on errors", () => {
    expect(apiErrorSchema.safeParse({ error: { code: "NOT_FOUND" } }).success).toBe(false);
    expect(
      apiErrorSchema.safeParse({ error: { code: "NOT_FOUND", message: "Not found" } }).success,
    ).toBe(true);
  });
});
