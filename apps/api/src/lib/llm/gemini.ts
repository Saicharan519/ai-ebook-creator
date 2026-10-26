import { ApiError, GoogleGenAI, ThinkingLevel, type GenerateContentConfig } from "@google/genai";
import { AppError } from "../errors";
import { logger } from "../logger";
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingPurpose,
  type LlmProvider,
  type LlmRequest,
  type LlmStreamEvent,
  type LlmUsage,
  type Reasoning,
} from "./types";

// Thinking tokens count against maxOutputTokens. With the model's default level a
// 1,024-token request spent ~980 tokens thinking and returned 30 words, after 7 s.
// Minimal thinking gave the full text with the first words in under 2 s.
const THINKING_LEVELS: Record<Reasoning, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
};

/** Waits between attempts when Gemini is temporarily unavailable */
const DEFAULT_RETRY_DELAYS_MS = [1_000, 3_000];

/** Texts per embedding request; keeps each request comfortably within API limits */
const EMBED_BATCH_SIZE = 50;

const TASK_TYPES: Record<EmbeddingPurpose, string> = {
  document: "RETRIEVAL_DOCUMENT",
  query: "RETRIEVAL_QUERY",
};

/** Below full size, Gemini embeddings aren't unit length; cosine search expects them to be. */
function normalize(vector: number[]): number[] {
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}

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
    // A 429 is either a short rate limit (wait a minute) or the API key's daily
    // quota (wait until tomorrow); telling users to "try again in a moment" for
    // the second would be wrong
    if (error.status === 429 && /per ?day/i.test(error.message)) {
      return new AppError(
        429,
        "AI_DAILY_LIMIT",
        "Today's AI limit for this server has been reached. It resets within 24 hours.",
      );
    }
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

export type GeminiModels = Pick<
  GoogleGenAI["models"],
  "generateContent" | "generateContentStream" | "embedContent"
>;

export class GeminiProvider implements LlmProvider {
  private readonly models: GeminiModels;
  private readonly retryDelaysMs: number[];
  private readonly embeddingModel: string;
  private readonly memoryModel: string;

  constructor(
    apiKey: string,
    private readonly model: string,
    options: {
      /** Tests pass a stand-in for the SDK and shorter delays */
      models?: GeminiModels;
      retryDelaysMs?: number[];
      embeddingModel?: string;
      /** Model for background Story Memory work; defaults to the main model */
      memoryModel?: string;
    } = {},
  ) {
    this.models = options.models ?? new GoogleGenAI({ apiKey }).models;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.embeddingModel = options.embeddingModel ?? "gemini-embedding-001";
    this.memoryModel = options.memoryModel ?? model;
  }

  /**
   * Background memory tasks run on their own model. Each model has its own
   * quota, so reading chapters never uses up the quota for writing help.
   */
  private modelFor(request: LlmRequest): string {
    return request.task === "memory" || request.task === "consistency"
      ? this.memoryModel
      : this.model;
  }

  async generate(request: LlmRequest) {
    return this.withRetry(async () => {
      const response = await this.models.generateContent({
        model: this.modelFor(request),
        contents: request.prompt,
        config: this.config(request),
      });
      return { text: response.text ?? "", usage: toUsage(response.usageMetadata) };
    }, request.signal);
  }

  async embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
      const batch = texts.slice(start, start + EMBED_BATCH_SIZE);
      const response = await this.withRetry(() =>
        this.models.embedContent({
          model: this.embeddingModel,
          contents: batch,
          config: { taskType: TASK_TYPES[purpose], outputDimensionality: EMBEDDING_DIMENSIONS },
        }),
      );
      const embeddings = response.embeddings ?? [];
      if (embeddings.length !== batch.length) {
        throw new AppError(502, "AI_UNAVAILABLE", "The embedding service returned bad data.");
      }
      vectors.push(...embeddings.map((embedding) => normalize(embedding.values ?? [])));
    }
    return vectors;
  }

  /** Runs a request, retrying temporary failures with backoff. */
  private async withRetry<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await run();
      } catch (error) {
        if (isTransient(error) && attempt < this.retryDelaysMs.length) {
          await sleep(this.retryDelaysMs[attempt]!, signal);
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
          model: this.modelFor(request),
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
