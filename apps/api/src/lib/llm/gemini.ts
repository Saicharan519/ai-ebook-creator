import { ApiError, GoogleGenAI, type GenerateContentConfig } from "@google/genai";
import { AppError } from "../errors";
import type { LlmProvider, LlmRequest, LlmStreamEvent, LlmUsage } from "./types";

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

/** Turns vendor errors into errors the client can act on, without leaking details. */
function toAppError(error: unknown): unknown {
  if (error instanceof Error && error.name === "AbortError") return error;
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return new AppError(503, "AI_BUSY", "The AI service is busy. Try again in a minute.");
    }
    return new AppError(502, "AI_UNAVAILABLE", "The AI service returned an error.");
  }
  return error;
}

export class GeminiProvider implements LlmProvider {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(request: LlmRequest) {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: request.prompt,
        config: this.config(request),
      });
      return { text: response.text ?? "", usage: toUsage(response.usageMetadata) };
    } catch (error) {
      throw toAppError(error);
    }
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    let usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };
    try {
      const stream = await this.client.models.generateContentStream({
        model: this.model,
        contents: request.prompt,
        config: this.config(request),
      });
      for await (const chunk of stream) {
        if (chunk.text) yield { type: "text", text: chunk.text };
        // The running total arrives with the chunks; the last one is complete
        if (chunk.usageMetadata) usage = toUsage(chunk.usageMetadata);
      }
    } catch (error) {
      throw toAppError(error);
    }
    yield { type: "done", usage };
  }

  private config(request: LlmRequest): GenerateContentConfig {
    return {
      systemInstruction: request.system,
      abortSignal: request.signal,
      maxOutputTokens: request.maxOutputTokens,
      temperature: request.temperature,
      ...(request.jsonSchema !== undefined && {
        responseMimeType: "application/json",
        responseJsonSchema: request.jsonSchema,
      }),
    };
  }
}
