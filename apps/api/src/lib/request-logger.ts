import type { IncomingMessage, ServerResponse } from "node:http";
import { pinoHttp } from "pino-http";
import { logger } from "./logger";

/** Path without the query string, so values passed in URLs never reach the logs */
const pathOf = (req: IncomingMessage) => (req.url ?? "").split("?")[0];

/**
 * One short line per request ("GET /books 200"), instead of every header.
 * Headers can carry tokens and add nothing when reading logs; errors are
 * still logged in full by the error handler.
 */
export const requestLogger = pinoHttp({
  logger,
  // Load balancers and uptime checks hit /health constantly
  autoLogging: { ignore: (req) => pathOf(req) === "/health" },
  serializers: {
    req: (req: { id: unknown; method: string; url: string }) => ({
      id: req.id,
      method: req.method,
      path: req.url.split("?")[0],
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) =>
    err || res.statusCode >= 500 ? "error" : "info",
  customSuccessMessage: (req: IncomingMessage, res: ServerResponse) =>
    `${req.method} ${pathOf(req)} ${res.statusCode}`,
  customErrorMessage: (req: IncomingMessage, res: ServerResponse) =>
    `${req.method} ${pathOf(req)} ${res.statusCode} failed`,
});
