import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ApiError } from "@ebook/shared";
import { MulterError } from "multer";
import { ZodError, z } from "zod";
import { AppError, NotFoundError } from "../lib/errors";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let body: ApiError = { error: { code: "INTERNAL_ERROR", message: "Something went wrong" } };

  if (err instanceof AppError) {
    status = err.statusCode;
    body = { error: { code: err.code, message: err.message, details: err.details } };
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      error: { code: "VALIDATION_ERROR", message: "Invalid request", details: z.flattenError(err) },
    };
  } else if (err instanceof MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    status = tooLarge ? 413 : 400;
    body = {
      error: {
        code: tooLarge ? "FILE_TOO_LARGE" : "BAD_UPLOAD",
        message: tooLarge ? "File is too large" : err.message,
      },
    };
  } else if (isBodyParserError(err)) {
    status = err.status;
    body =
      err.status === 413
        ? { error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" } }
        : { error: { code: "BAD_REQUEST", message: "Malformed request body" } };
  }

  if (status >= 500) {
    req.log.error({ err }, "Unhandled error");
  }

  res.status(status).json(body);
};

function isBodyParserError(err: unknown): err is { status: number; type: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    "status" in err &&
    typeof err.status === "number" &&
    err.status >= 400 &&
    err.status < 500
  );
}
