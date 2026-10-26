import {
  addChaptersInputSchema,
  chapterSummarySchema,
  outlineSchema,
  streamDeltaSchema,
  streamErrorSchema,
  type AddChaptersInput,
  type OutlineInput,
} from "@ebook/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError, apiRequest, apiStream } from "../../lib/api";
import { readSse } from "../../lib/sse";
import { bookKeys } from "../books/books-api";

/**
 * Starts a streamed AI request and calls `onText` with each piece as it arrives.
 * Resolves when the stream ends; rejects with ApiRequestError if the server
 * reports an error, or with an AbortError if `signal` is aborted.
 */
export async function streamAi(
  path: string,
  body: unknown,
  { signal, onText }: { signal: AbortSignal; onText: (text: string) => void },
): Promise<void> {
  const res = await apiStream(path, { method: "POST", json: body, signal });
  if (!res.body) {
    throw new ApiRequestError(502, "AI_UNAVAILABLE", "The AI response was empty.");
  }

  for await (const event of readSse(res.body)) {
    if (event.event === "delta") {
      onText(streamDeltaSchema.parse(JSON.parse(event.data)).text);
    } else if (event.event === "error") {
      const error = streamErrorSchema.parse(JSON.parse(event.data));
      throw new ApiRequestError(502, error.code, error.message);
    } else if (event.event === "done") {
      return;
    }
  }
  // The connection closed without a "done" event
  throw new ApiRequestError(502, "AI_UNAVAILABLE", "The AI stopped responding. Try again.");
}

export function useGenerateOutline(bookId: string) {
  return useMutation({
    mutationFn: (input: OutlineInput) =>
      apiRequest(`/books/${bookId}/ai/outline`, outlineSchema, { method: "POST", json: input }),
  });
}

export function useAddChapters(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddChaptersInput) =>
      apiRequest(`/books/${bookId}/chapters/batch`, chapterSummarySchema.array(), {
        method: "POST",
        json: addChaptersInputSchema.parse(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookKeys.detail(bookId) }),
  });
}
