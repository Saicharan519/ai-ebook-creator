import { ApiError, GoogleGenAI, ThinkingLevel, type GenerateContentConfig } from "@google/genai";
import { AppError } from "../errors";
import { logger } from "../logger";
import type { LlmProvider, LlmRequest, LlmStreamEvent, LlmUsage, Reasoning } from "./types";

// Thinking tokens count against maxOutputTokens. With the model's default level a
// 1,024-token request spent ~980 tokens thinking and returned 30 words, after 7 s.
// Minimal thinking gave the full text with the first words in under 2 s.
const THINKING_LEVELS: Record<Reasoning, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
};

/** Waits between attempts when Gemini is temporarily unavailable */
const DEFAULT_RETRY_DELAYS_MS = [1_000, 3_000];

interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
}

function toUsage(metadata: UsageMetadata | undefined): LlmUsage {
  return {
    inputTokens: metadata?.promptTokenCount ?? 0,
    // Thinking tokens are billed as output
    outputTokens: (metadata?.candidatesTokenCount ?? 0) + (metadata?.thoughtsTokenCount ?? 0),
  };
}

/** Overload and server errors usually clear up within seconds, so they're worth retrying. */
function isTransient(error: unknown): boolean {
  return error instanceof ApiError && [500, 502, 503, 504].includes(error.status);
}

/**
 * Turns vendor errors into errors the client can act on. The client gets a
 * generic message; the vendor's own message is logged here for debugging.
 */
function toAppError(error: unknown): unknown {
  if (error instanceof Error && error.name === "AbortError") return error;
  if (error instanceof ApiError) {
    logger.warn({ status: error.status, vendorMessage: error.message }, "Gemini request failed");
    if (error.status === 429 || isTransient(error)) {
      return new AppError(503, "AI_BUSY", "The AI is overloaded right now. Try again in a moment.");
    }
    return new AppError(502, "AI_UNAVAILABLE", "The AI service returned an error.");
  }
  return error;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

export type GeminiModels = Pick<GoogleGenAI["models"], "generateContent" | "generateContentStream">;

export class GeminiProvider implements LlmProvider {
  private readonly models: GeminiModels;
  private readonly retryDelaysMs: number[];

  constructor(
    apiKey: string,
    private readonly model: string,
    /** Tests pass a stand-in for the SDK and shorter delays */
    options: { models?: GeminiModels; retryDelaysMs?: number[] } = {},
  ) {
    this.models = options.models ?? new GoogleGenAI({ apiKey }).models;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  }

  async generate(request: LlmRequest) {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await this.models.generateContent({
          model: this.model,
          contents: request.prompt,
          config: this.config(request),
        });
        return { text: response.text ?? "", usage: toUsage(response.usageMetadata) };
      } catch (error) {
        if (isTransient(error) && attempt < this.retryDelaysMs.length) {
          await sleep(this.retryDelaysMs[attempt]!, request.signal);
          continue;
        }
        throw toAppError(error);
      }
    }
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    let usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };
    let sentText = false;

    for (let attempt = 0; ; attempt++) {
      try {
        const stream = await this.models.generateContentStream({
          model: this.model,
          contents: request.prompt,
          config: this.config(request),
        });
        for await (const chunk of stream) {
          if (chunk.text) {
            sentText = true;
            yield { type: "text", text: chunk.text };
          }
          // The running total arrives with the chunks; the last one is complete
          if (chunk.usageMetadata) usage = toUsage(chunk.usageMetadata);
        }
        break;
      } catch (error) {
        // Once text has reached the user, a retry would repeat it, so only
        // failures before the first piece of text are retried
        if (!sentText && isTransient(error) && attempt < this.retryDelaysMs.length) {
          await sleep(this.retryDelaysMs[attempt]!, request.signal);
          continue;
        }
        throw toAppError(error);
      }
    }
    yield { type: "done", usage };
  }

  private config(request: LlmRequest): GenerateContentConfig {
    return {
      systemInstruction: request.system,
      abortSignal: request.signal,
      maxOutputTokens: request.maxOutputTokens,
      temperature: request.temperature,
      thinkingConfig: { thinkingLevel: THINKING_LEVELS[request.reasoning ?? "minimal"] },
      ...(request.jsonSchema !== undefined && {
        responseMimeType: "application/json",
        responseJsonSchema: request.jsonSchema,
      }),
    };
  }
}
