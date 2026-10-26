import { z } from "zod";
import { NotFoundError } from "./errors";

const uuid = z.uuid();

/**
 * Reads a UUID route parameter. A malformed id can't match any row, so it's
 * reported as "not found" instead of reaching the database as a type error.
 */
export function idParam(value: string | string[] | undefined, what: string): string {
  const result = uuid.safeParse(value);
  if (!result.success) {
    throw new NotFoundError(`${what} not found`);
  }
  return result.data;
}
