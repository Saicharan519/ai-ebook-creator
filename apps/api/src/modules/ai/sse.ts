import type { Response } from "express";
import { AppError } from "../../lib/errors";
import type { LlmStreamEvent, LlmUsage } from "../../lib/llm";
import { logger } from "../../lib/logger";

export interface StreamResult {
  /** Token usage reported by the model; null if the stream ended early */
  usage: LlmUsage | null;
  outputChars: number;
}

/**
 * Relays model output to the browser as Server-Sent Events:
 *   event: delta  data: {"text": "..."}   (repeated)
 *   event: done   data: {}
 *   event: error  data: {"code": "...", "message": "..."}
 *
 * Headers are only sent once the first event arrives. Until then a failure
 * (bad API key, provider outage) can still become a normal JSON error response.
 *
 * `beforeEnd` runs after the last event but before the response closes, so work
 * such as recording token usage is finished by the time the client sees the end.
 */
export async function streamToClient(
  res: Response,
  events: AsyncIterable<LlmStreamEvent>,
  signal: AbortSignal,
  beforeEnd: (result: StreamResult) => Promise<void> = async () => {},
): Promise<StreamResult> {
  const iterator = events[Symbol.asyncIterator]();
  let next = await iterator.next();

  res.status(200);
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Stops proxies such as nginx from buffering the stream
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    if (!res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let usage: LlmUsage | null = null;
  let outputChars = 0;
  try {
    while (!next.done && !signal.aborted) {
      const event = next.value;
      if (event.type === "text") {
        outputChars += event.text.length;
        send("delta", { text: event.text });
      } else {
        usage = event.usage;
      }
      next = await iterator.next();
    }
    send("done", {});
  } catch (error) {
    if (!signal.aborted) {
      logger.error({ err: error }, "AI stream failed");
      const appError =
        error instanceof AppError
          ? error
          : new AppError(502, "AI_UNAVAILABLE", "The AI stopped responding. Try again.");
      send("error", { code: appError.code, message: appError.message });
    }
  } finally {
    try {
      await beforeEnd({ usage, outputChars });
    } catch (error) {
      logger.error({ err: error }, "Work after an AI stream failed");
    }
    res.end();
  }

  return { usage, outputChars };
}
