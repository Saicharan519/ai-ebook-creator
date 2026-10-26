import { z } from "zod";
import { ApiRequestError } from "./api";

export type FieldErrors = Record<string, string | undefined>;

/** First error message per field, from a failed Zod parse. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const { fieldErrors } = z.flattenError(error);
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [field, (messages as string[])[0]]),
  );
}

/** A message for the user from any thrown error. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof TypeError) return "Can't reach the server. Check your connection.";
  return "Something went wrong. Please try again.";
}
