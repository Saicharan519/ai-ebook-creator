import { pino } from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  // Never write credentials to the logs
  redact: ["req.headers.authorization", "req.headers.cookie"],
});
