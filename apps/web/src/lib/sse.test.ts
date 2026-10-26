import { describe, expect, it } from "vitest";
import { readSse, type SseEvent } from "./sse";

/** A response body that arrives in exactly the given pieces. */
function bodyFrom(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>): Promise<SseEvent[]> {
  const events: SseEvent[] = [];
  for await (const event of readSse(body)) events.push(event);
  return events;
}

describe("readSse", () => {
  it("parses named events", async () => {
    const events = await collect(
      bodyFrom(['event: delta\ndata: {"text":"Hi"}\n\n', "event: done\ndata: {}\n\n"]),
    );

    expect(events).toEqual([
      { event: "delta", data: '{"text":"Hi"}' },
      { event: "done", data: "{}" },
    ]);
  });

  it("reassembles events split across network chunks", async () => {
    const events = await collect(
      bodyFrom(["event: del", 'ta\ndata: {"te', 'xt":"split"}\n', "\nevent: done\ndata: {}\n\n"]),
    );

    expect(events.map((e) => e.data)).toEqual(['{"text":"split"}', "{}"]);
  });

  it("keeps multi-byte characters intact when a chunk ends mid-character", async () => {
    const bytes = new TextEncoder().encode('event: delta\ndata: {"text":"naïve ü"}\n\n');
    const splitAt = bytes.indexOf(0xc3) + 1; // inside the two-byte "ï"

    const events = await collect(bodyFrom([bytes.slice(0, splitAt), bytes.slice(splitAt)]));

    expect(JSON.parse(events[0]!.data).text).toBe("naïve ü");
  });

  it("handles CRLF line endings and a final event without a trailing blank line", async () => {
    const events = await collect(bodyFrom(["event: delta\r\ndata: a\r\n\r\nevent: done\ndata: b"]));
    expect(events).toEqual([
      { event: "delta", data: "a" },
      { event: "done", data: "b" },
    ]);
  });
});
