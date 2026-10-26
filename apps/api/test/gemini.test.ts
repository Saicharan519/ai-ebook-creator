import { ApiError, type GenerateContentResponse } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../src/lib/errors";
import { GeminiProvider, type GeminiModels } from "../src/lib/llm/gemini";
import type { LlmStreamEvent } from "../src/lib/llm";

const overloaded = () => new ApiError({ message: "model overloaded", status: 503 });
const response = (text: string) =>
  ({
    text,
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2 },
  }) as unknown as GenerateContentResponse;

async function* chunks(...pieces: (string | Error)[]) {
  for (const piece of pieces) {
    if (piece instanceof Error) throw piece;
    yield response(piece);
  }
}

const generateMock = () => vi.fn<GeminiModels["generateContent"]>();
const streamMock = () => vi.fn<GeminiModels["generateContentStream"]>();

function provider(models: Partial<GeminiModels>) {
  return new GeminiProvider("key", "model", {
    models: {
      generateContent: models.generateContent ?? generateMock(),
      generateContentStream: models.generateContentStream ?? streamMock(),
      embedContent: models.embedContent ?? vi.fn<GeminiModels["embedContent"]>(),
    },
    retryDelaysMs: [1, 1],
  });
}

async function collect(stream: AsyncIterable<LlmStreamEvent>) {
  const events: LlmStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

const request = { task: "inline" as const, system: "s", prompt: "p" };

describe("GeminiProvider", () => {
  it("retries a temporary overload and counts thinking tokens as output", async () => {
    const generateContent = generateMock()
      .mockRejectedValueOnce(overloaded())
      .mockResolvedValueOnce(response("ok"));

    const result = await provider({ generateContent }).generate(request);

    expect(result).toEqual({ text: "ok", usage: { inputTokens: 10, outputTokens: 7 } });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last retry with a clear 'busy' error", async () => {
    const generateContent = generateMock().mockRejectedValue(overloaded());

    const error = await provider({ generateContent })
      .generate(request)
      .catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ statusCode: 503, code: "AI_BUSY" });
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it("doesn't retry errors that won't go away, like a bad request", async () => {
    const generateContent = generateMock().mockRejectedValue(
      new ApiError({ message: "bad schema", status: 400 }),
    );

    const error = await provider({ generateContent })
      .generate(request)
      .catch((e) => e);

    expect(error).toMatchObject({ code: "AI_UNAVAILABLE" });
    expect(generateContent).toHaveBeenCalledOnce();
  });

  it("retries a stream that fails before any text was sent", async () => {
    const generateContentStream = streamMock()
      .mockRejectedValueOnce(overloaded())
      .mockResolvedValueOnce(chunks("Hello ", "world"));

    const events = await collect(provider({ generateContentStream }).stream(request));

    expect(events.filter((e) => e.type === "text").map((e) => e.text)).toEqual(["Hello ", "world"]);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("never retries once text has been sent, so nothing is repeated", async () => {
    const generateContentStream = streamMock()
      .mockResolvedValueOnce(chunks("Half a sen", overloaded()))
      .mockResolvedValueOnce(chunks("should not appear"));

    const events: LlmStreamEvent[] = [];
    const error = await (async () => {
      for await (const event of provider({ generateContentStream }).stream(request)) {
        events.push(event);
      }
    })().catch((e) => e);

    expect(events).toEqual([{ type: "text", text: "Half a sen" }]);
    expect(error).toMatchObject({ code: "AI_BUSY" });
    expect(generateContentStream).toHaveBeenCalledOnce();
  });

  it("asks for minimal thinking unless told otherwise", async () => {
    const generateContent = generateMock().mockResolvedValue(response("ok"));
    const llm = provider({ generateContent });

    await llm.generate(request);
    await llm.generate({ ...request, reasoning: "low" });

    expect(generateContent.mock.calls[0]![0].config?.thinkingConfig).toEqual({
      thinkingLevel: "MINIMAL",
    });
    expect(generateContent.mock.calls[1]![0].config?.thinkingConfig).toEqual({
      thinkingLevel: "LOW",
    });
  });
});
