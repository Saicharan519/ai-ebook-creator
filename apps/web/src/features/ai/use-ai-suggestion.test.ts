import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "../../lib/api";
import { useAiSuggestion } from "./use-ai-suggestion";

const encoder = new TextEncoder();
const sse = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

/** A streamed response whose chunks are released one by one by the test. */
function controllableStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
  return {
    response: new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    push: (chunk: Uint8Array) => controller.enqueue(chunk),
    end: () => controller.close(),
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setAccessToken("token");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => setAccessToken(null));

const request = { path: "/books/b/chapters/c/ai/inline", body: { action: "continue" } };

describe("useAiSuggestion", () => {
  it("shows text as it streams in, then finishes", async () => {
    const stream = controllableStream();
    fetchMock.mockResolvedValueOnce(stream.response);
    const { result } = renderHook(() => useAiSuggestion());

    act(() => void result.current.start(request));
    stream.push(sse("delta", { text: "Once " }));
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: "streaming", text: "Once " }),
    );

    stream.push(sse("delta", { text: "upon a time." }));
    stream.push(sse("done", {}));
    stream.end();

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "done",
        text: "Once upon a time.",
        stopped: false,
      }),
    );
  });

  it("keeps the partial text when the user presses Stop", async () => {
    const stream = controllableStream();
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      init.signal?.addEventListener("abort", () => stream.end());
      return Promise.resolve(stream.response);
    });
    const { result } = renderHook(() => useAiSuggestion());

    act(() => void result.current.start(request));
    stream.push(sse("delta", { text: "Half" }));
    await waitFor(() => expect(result.current.state).toMatchObject({ text: "Half" }));

    act(() => result.current.stop());

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: "done", text: "Half", stopped: true }),
    );
    expect((fetchMock.mock.calls[0]![1] as RequestInit).signal?.aborted).toBe(true);
  });

  it("reports an error event from the server", async () => {
    const stream = controllableStream();
    fetchMock.mockResolvedValueOnce(stream.response);
    const { result } = renderHook(() => useAiSuggestion());

    act(() => void result.current.start(request));
    stream.push(sse("delta", { text: "Par" }));
    stream.push(sse("error", { code: "AI_UNAVAILABLE", message: "The AI stopped responding." }));
    stream.end();

    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: "error",
        text: "Par",
        message: "The AI stopped responding.",
      }),
    );
  });

  it("reports errors that happen before streaming, like a used-up quota", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: "AI_QUOTA_EXCEEDED", message: "You've used today's AI allowance." },
        }),
        { status: 429 },
      ),
    );
    const { result } = renderHook(() => useAiSuggestion());

    await act(() => result.current.start(request));

    expect(result.current.state).toEqual({
      status: "error",
      text: "",
      message: "You've used today's AI allowance.",
    });
  });
});
