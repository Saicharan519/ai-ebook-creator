import { inlineInputSchema, outlineInputSchema, outlineSchema, type Outline } from "@ebook/shared";
import { Router, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AiKind } from "../../generated/prisma/client";
import { env } from "../../lib/env";
import { AppError } from "../../lib/errors";
import type { LlmProvider, LlmRequest, LlmUsage } from "../../lib/llm";
import { idParam } from "../../lib/params";
import { currentUserId } from "../../middleware/require-auth";
import { loadBookBrief, loadChapterBrief } from "./ai-context";
import { assertWithinQuota, getUsageToday, recordUsage } from "./ai-usage";
import { buildMemoryContext } from "./context-builder";
import { chapterDraftPrompt, inlinePrompt, outlinePrompt } from "./prompts";
import { streamToClient } from "./sse";

// Gemini's structured output takes a plain JSON Schema; Zod still validates the result
const OUTLINE_JSON_SCHEMA = z.toJSONSchema(
  z.object({
    chapters: z.array(z.object({ title: z.string(), description: z.string() })),
  }),
);

/** If the stream ends early there's no usage report; estimate ~4 characters per token. */
function estimateUsage(request: LlmRequest, outputChars: number): LlmUsage {
  return {
    inputTokens: Math.ceil((request.system.length + request.prompt.length) / 4),
    outputTokens: Math.ceil(outputChars / 4),
  };
}

/**
 * Builds the AI routes. With no provider configured they all answer 503,
 * so the rest of the app works without an API key.
 */
export function createAiRouter(llm: LlmProvider | null) {
  const router = Router();

  function provider(): LlmProvider {
    if (!llm) {
      throw new AppError(
        503,
        "AI_NOT_CONFIGURED",
        "AI isn't set up on this server. Add a GEMINI_API_KEY to enable it.",
      );
    }
    return llm;
  }

  // Per user rather than per IP: these calls cost money
  const perUserLimit = rateLimit({
    windowMs: 60_000,
    limit: env.AI_RATE_LIMIT_PER_MINUTE,
    keyGenerator: (req) => currentUserId(req),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(429, "TOO_MANY_REQUESTS", "Too many AI requests. Wait a moment."));
    },
  });

  router.post("/:bookId/ai/outline", perUserLimit, async (req, res) => {
    const model = provider();
    const userId = currentUserId(req);
    const bookId = idParam(req.params.bookId, "Book");
    const { chapterCount, guidance } = outlineInputSchema.parse(req.body);
    await assertWithinQuota(userId);

    const book = await loadBookBrief(userId, bookId);
    const request = {
      ...outlinePrompt(book, chapterCount, guidance),
      jsonSchema: OUTLINE_JSON_SCHEMA,
    };

    // Structured output is reliable but not guaranteed, so allow one retry
    const usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };
    let outline: Outline | null = null;
    for (let attempt = 0; attempt < 2 && !outline; attempt++) {
      const result = await model.generate(request);
      usage.inputTokens += result.usage.inputTokens;
      usage.outputTokens += result.usage.outputTokens;
      outline = parseOutline(result.text);
    }
    await recordUsage(userId, "outline", usage);

    if (!outline) {
      throw new AppError(502, "AI_BAD_RESPONSE", "The AI's outline couldn't be read. Try again.");
    }
    res.json({ chapters: outline.chapters.slice(0, chapterCount) });
  });

  router.post("/:bookId/chapters/:chapterId/ai/draft", perUserLimit, async (req, res) => {
    provider();
    const userId = currentUserId(req);
    const bookId = idParam(req.params.bookId, "Book");
    const chapterId = idParam(req.params.chapterId, "Chapter");
    await assertWithinQuota(userId);

    const [book, chapter] = await Promise.all([
      loadBookBrief(userId, bookId),
      loadChapterBrief(userId, bookId, chapterId),
    ]);
    const memory = await buildMemoryContext(provider(), {
      bookId,
      chapterId,
      chapterPosition: chapter.position,
      focusText: [chapter.title, chapter.description, chapter.previousChapterEnding.slice(-1_500)]
        .filter(Boolean)
        .join("\n\n"),
    });
    await stream(res, userId, "draft", chapterDraftPrompt(book, chapter, memory));
  });

  router.post("/:bookId/chapters/:chapterId/ai/inline", perUserLimit, async (req, res) => {
    provider();
    const userId = currentUserId(req);
    const bookId = idParam(req.params.bookId, "Book");
    const chapterId = idParam(req.params.chapterId, "Chapter");
    const input = inlineInputSchema.parse(req.body);
    await assertWithinQuota(userId);

    const [book, chapter] = await Promise.all([
      loadBookBrief(userId, bookId),
      loadChapterBrief(userId, bookId, chapterId),
    ]);
    const memory = await buildMemoryContext(provider(), {
      bookId,
      chapterId,
      chapterPosition: chapter.position,
      focusText: input.selection || input.before.slice(-1_500),
    });
    await stream(res, userId, "inline", inlinePrompt(book, chapter, input, memory));
  });

  async function stream(res: Response, userId: string, kind: AiKind, request: LlmRequest) {
    // Closing the tab or pressing Stop cancels the model call, so nobody pays for unread text
    const model = provider();
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) controller.abort();
    });

    // Usage is recorded before the response ends, so a request sent right after
    // this one is checked against an up-to-date daily quota
    await streamToClient(
      res,
      model.stream({ ...request, signal: controller.signal }),
      controller.signal,
      (result) =>
        recordUsage(userId, kind, result.usage ?? estimateUsage(request, result.outputChars)),
    );
  }

  return router;
}

function parseOutline(text: string): Outline | null {
  try {
    const result = outlineSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** GET /ai/usage: today's token use, for showing the allowance in the UI */
export const aiUsageRouter = Router();
aiUsageRouter.get("/usage", async (req, res) => {
  res.json(await getUsageToday(currentUserId(req)));
});
