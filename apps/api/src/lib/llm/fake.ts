import type { LlmProvider, LlmRequest, LlmStreamEvent } from "./types";

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

const defaultResponder: Responder = (request) =>
  request.jsonSchema !== undefined ? fakeOutline(request) : PLACEHOLDER;

/**
 * Deterministic stand-in for a real model: used by tests, and in development
 * when no API key is configured. Records every request so tests can inspect prompts.
 */
export class FakeLlmProvider implements LlmProvider {
  readonly requests: LlmRequest[] = [];

  constructor(
    private readonly options: { respond?: Responder; chunkDelayMs?: number; failWith?: Error } = {},
  ) {}

  async generate(request: LlmRequest) {
    this.requests.push(request);
    if (this.options.failWith) throw this.options.failWith;
    const text = (this.options.respond ?? defaultResponder)(request);
    return { text, usage: this.usageFor(request, text) };
  }

  async *stream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    this.requests.push(request);
    if (this.options.failWith) throw this.options.failWith;
    const text = (this.options.respond ?? defaultResponder)(request);

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

  /** Roughly 4 characters per token, which is close enough for quota tests */
  private usageFor(request: LlmRequest, output: string) {
    return {
      inputTokens: Math.ceil((request.system.length + request.prompt.length) / 4),
      outputTokens: Math.ceil(output.length / 4),
    };
  }
}
