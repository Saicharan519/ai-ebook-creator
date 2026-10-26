import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/lib/env";

const valid = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  CORS_ORIGINS: "http://localhost:5173, https://app.example.com",
};

describe("parseEnv", () => {
  it("applies defaults and splits CORS origins", () => {
    const env = parseEnv(valid);

    expect(env.PORT).toBe(8000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.CORS_ORIGINS).toEqual(["http://localhost:5173", "https://app.example.com"]);
  });

  it("lists every invalid variable", () => {
    const message = (() => {
      try {
        parseEnv({ PORT: "abc" });
        return "";
      } catch (error) {
        return (error as Error).message;
      }
    })();

    expect(message).toContain("PORT");
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("CORS_ORIGINS");
  });

  it("rejects a database URL that is not a URL", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "not a url" })).toThrow(/DATABASE_URL/);
  });
});
