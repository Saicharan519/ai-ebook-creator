export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * How much the model may "think" before answering. More thinking can improve
 * planning, but it is slower and its tokens come out of maxOutputTokens.
 */
export type Reasoning = "minimal" | "low";

/** What a request is for; used in logs, and by the fake provider to pick a reply. */
export type LlmTask = "outline" | "draft" | "inline" | "memory" | "consistency";

export interface LlmRequest {
  task: LlmTask;
  /** Defaults to "minimal" */
  reasoning?: Reasoning;
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

/** Embeddings for stored passages and for search queries are computed slightly differently. */
export type EmbeddingPurpose = "document" | "query";

/** Length of every embedding vector; must match the vector(…) column in the database */
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Every AI call in the app goes through this interface, so the model vendor
 * can change without touching features, and tests can use a fake.
 */
export interface LlmProvider {
  generate(request: LlmRequest): Promise<{ text: string; usage: LlmUsage }>;
  stream(request: LlmRequest): AsyncIterable<LlmStreamEvent>;
  /** One unit-length vector per text, in the same order */
  embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]>;
}
