import { healthResponseSchema, apiErrorSchema } from "@ebook/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";

const app = createApp();

describe("GET /health", () => {
  it("reports the API and database as up", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.database).toBe("up");
  });

  it("sets security headers and hides the framework", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("CORS", () => {
  it("allows configured origins", async () => {
    const res = await request(app).get("/health").set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("does not allow other origins", async () => {
    const res = await request(app).get("/health").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("error responses", () => {
  it("returns a JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/does-not-exist");

    expect(res.status).toBe(404);
    expect(apiErrorSchema.parse(res.body).error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for malformed JSON instead of crashing", async () => {
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(res.body).error.code).toBe("BAD_REQUEST");
  });
});
