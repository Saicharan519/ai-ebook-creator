export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmRequest {
  /** Instructions: role, rules, output format */
  system: string;
  /** The task, including any user text (kept clearly separated from instructions) */
  prompt: string;
  /** Ask for JSON matching this JSON Schema */
  jsonSchema?: unknown;
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export type LlmStreamEvent = { type: "text"; text: string } | { type: "done"; usage: LlmUsage };

/**
 * Every AI call in the app goes through this interface, so the model vendor
 * can change without touching features, and tests can use a fake.
 */
export interface LlmProvider {
  generate(request: LlmRequest): Promise<{ text: string; usage: LlmUsage }>;
  stream(request: LlmRequest): AsyncIterable<LlmStreamEvent>;
}
