import { apiErrorSchema } from "@ebook/shared";
import express from "express";
import { pinoHttp } from "pino-http";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, NotFoundError } from "../src/lib/errors";
import { logger } from "../src/lib/logger";
import { errorHandler } from "../src/middleware/error-handler";

/** A tiny app whose only route throws the given error. */
function appThrowing(error: unknown) {
  const app = express();
  app.use(pinoHttp({ logger }));
  app.get("/", () => {
    throw error;
  });
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("uses the status and code from AppError", async () => {
    const res = await request(appThrowing(new NotFoundError("Book not found"))).get("/");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Book not found" } });
  });

  it("passes AppError details through", async () => {
    const error = new AppError(422, "UNPROCESSABLE", "Nope", { field: "title" });
    const res = await request(appThrowing(error)).get("/");

    expect(res.status).toBe(422);
    expect(res.body.error.details).toEqual({ field: "title" });
  });

  it("turns Zod errors into 400 with field details", async () => {
    const parsed = z.object({ title: z.string() }).safeParse({ title: 5 });
    const res = await request(appThrowing(parsed.error)).get("/");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.fieldErrors.title).toBeDefined();
  });

  it("hides internal details of unexpected errors", async () => {
    const res = await request(appThrowing(new Error("db password is hunter2"))).get("/");

    expect(res.status).toBe(500);
    const body = apiErrorSchema.parse(res.body);
    expect(body.error.message).toBe("Something went wrong");
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
  });
});
