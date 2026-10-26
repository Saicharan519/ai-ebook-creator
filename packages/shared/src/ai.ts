import { z } from "zod";

export const MAX_OUTLINE_CHAPTERS = 40;

export const inlineActionSchema = z.enum([
  "continue",
  "rewrite",
  "expand",
  "shorten",
  "tone",
  "show",
]);

export const INLINE_ACTION_LABELS: Record<InlineAction, string> = {
  continue: "Continue writing",
  rewrite: "Rewrite",
  expand: "Expand",
  shorten: "Shorten",
  tone: "Change tone",
  show: "Show, don't tell",
};

export const inlineInputSchema = z
  .object({
    action: inlineActionSchema,
    /** The selected text the action applies to (empty for "continue") */
    selection: z.string().max(10_000).default(""),
    /** Text just before the selection or cursor, for context */
    before: z.string().max(20_000).default(""),
    /** Text just after the selection, for context */
    after: z.string().max(5_000).default(""),
    /** Target tone, for the "tone" action, e.g. "tense", "playful" */
    tone: z.string().trim().min(1).max(50).optional(),
  })
  .refine((input) => input.action === "continue" || input.selection.trim().length > 0, {
    message: "Select some text first",
    path: ["selection"],
  })
  .refine((input) => input.action !== "tone" || input.tone !== undefined, {
    message: "Choose a tone",
    path: ["tone"],
  });

export const outlineInputSchema = z.object({
  chapterCount: z.int().min(1).max(MAX_OUTLINE_CHAPTERS),
  guidance: z.string().trim().max(2_000).optional(),
});

export const outlineChapterSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1_000),
});

export const outlineSchema = z.object({
  chapters: z.array(outlineChapterSchema).min(1).max(MAX_OUTLINE_CHAPTERS),
});

export const addChaptersInputSchema = z.object({
  chapters: z
    .array(
      z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(2_000) }),
    )
    .min(1)
    .max(MAX_OUTLINE_CHAPTERS),
  /** Remove existing chapters first, but only if none of them has any text yet */
  replaceEmpty: z.boolean().default(false),
});

export const aiUsageSchema = z.object({
  usedToday: z.int().nonnegative(),
  dailyLimit: z.int().positive(),
});

// Server-sent events for streamed AI responses
export const streamDeltaSchema = z.object({ text: z.string() });
export const streamErrorSchema = z.object({ code: z.string(), message: z.string() });

export type InlineAction = z.infer<typeof inlineActionSchema>;
export type InlineInput = z.input<typeof inlineInputSchema>;
export type OutlineInput = z.infer<typeof outlineInputSchema>;
export type OutlineChapter = z.infer<typeof outlineChapterSchema>;
export type Outline = z.infer<typeof outlineSchema>;
export type AddChaptersInput = z.input<typeof addChaptersInputSchema>;
export type AiUsage = z.infer<typeof aiUsageSchema>;
