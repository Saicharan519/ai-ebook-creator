import { env } from "../env";
import { FakeLlmProvider } from "./fake";
import { GeminiProvider } from "./gemini";
import type { LlmProvider } from "./types";

export type { LlmProvider, LlmRequest, LlmStreamEvent, LlmUsage } from "./types";
export { FakeLlmProvider } from "./fake";

/** The provider configured by environment variables, or null if AI isn't set up. */
export function createLlmProvider(): LlmProvider | null {
  if (env.AI_PROVIDER === "fake") {
    return new FakeLlmProvider({ chunkDelayMs: 40 });
  }
  return env.GEMINI_API_KEY ? new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL) : null;
}
