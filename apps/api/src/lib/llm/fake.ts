import { createHash } from "node:crypto";
import {
  EMBEDDING_DIMENSIONS,
  type LlmProvider,
  type LlmRequest,
  type LlmStreamEvent,
  type LlmTask,
} from "./types";

type Responder = (request: LlmRequest) => string;

const PLACEHOLDER =
  "The lantern swung in the wind as Mara stepped onto the ferry. *This is placeholder text from " +
  "the fake AI provider.* Set AI_PROVIDER=gemini and add a GEMINI_API_KEY to get real writing.";

/** Builds a valid outline response for any requested chapter count. */
function fakeOutline(request: LlmRequest): string {
  const count = Number(/exactly (\d+) chapters/.exec(request.prompt)?.[1] ?? 3);
  return JSON.stringify({
    chapters: Array.from({ length: count }, (_, i) => ({
      title: `Placeholder chapter ${i + 1}`,
      description: "A placeholder description from the fake AI provider.",
    })),
  });
}

const DEFAULT_REPLIES: Record<LlmTask, Responder> = {
  outline: fakeOutline,
  draft: () => PLACEHOLDER,
  inline: () => PLACEHOLDER,
  memory: () => JSON.stringify({ summary: "A placeholder summary.", entities: [] }),
  consistency: () => JSON.stringify({ verdicts: [] }),
};

/**
 * A bag-of-words embedding: each word is hashed into one of the dimensions.
 * Texts that share words get similar vectors, so similarity search behaves
 * sensibly in tests without calling a real model.
 */
export function fakeEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    const hash = createHash("md5").update(word).digest();
    vector[hash.readUInt32BE(0) % EMBEDDING_DIMENSIONS]! += 1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}

/**
 * Deterministic stand-in for a real model: used by tests, and in development
 * when no API key is configured. Records every request so tests can inspect prompts.
 */
export class FakeLlmProvider implements LlmProvider {
  readonly requests: LlmRequest[] = [];
  readonly embedded: string[] = [];

  constructor(
    private readonly options: { respond?: Responder; chunkDelayMs?: number; failWith?: Error } = {},
  ) {}

  async generate(request: LlmRequest) {
    this.requests.push(request);
    if (this.options.failWith) throw this.options.failWith;
    const text = this.reply(request);
    return { text, usage: this.usageFor(request, text) };
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    this.requests.push(request);
    if (this.options.failWith) throw this.options.failWith;
    const text = this.reply(request);

    // Stream word by word, like a real model
    for (const piece of text.match(/\S+\s*/g) ?? []) {
      if (request.signal?.aborted) return;
      if (this.options.chunkDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, this.options.chunkDelayMs));
      }
      yield { type: "text", text: piece };
    }
    yield { type: "done", usage: this.usageFor(request, text) };
  }

  async embed(texts: string[]) {
    this.embedded.push(...texts);
    return texts.map(fakeEmbedding);
  }

  private reply(request: LlmRequest) {
    return (this.options.respond ?? DEFAULT_REPLIES[request.task])(request);
  }

  /** Roughly 4 characters per token, which is close enough for quota tests */
  private usageFor(request: LlmRequest, output: string) {
    return {
      inputTokens: Math.ceil((request.system.length + request.prompt.length) / 4),
      outputTokens: Math.ceil(output.length / 4),
    };
  }
}
