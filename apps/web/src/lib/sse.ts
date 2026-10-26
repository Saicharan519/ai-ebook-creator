export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Reads a text/event-stream response body event by event. Network chunks can
 * split an event anywhere, so text is buffered until a blank line ends each event.
 */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  // stream: true keeps a multi-byte character split across chunks intact
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const event = parseEvent(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (event) yield event;
        boundary = buffer.indexOf("\n\n");
      }
    }
    const last = parseEvent(buffer);
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

function parseEvent(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  return data.length > 0 ? { event, data: data.join("\n") } : null;
}
