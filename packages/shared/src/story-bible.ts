import { z } from "zod";

export const entityKindSchema = z.enum(["character", "place", "item", "group"]);
export const memorySourceSchema = z.enum(["ai", "author"]);

const chapterRef = z.object({ id: z.uuid(), position: z.int(), title: z.string() });

export const storyFactSchema = z.object({
  id: z.uuid(),
  attribute: z.string(),
  value: z.string(),
  source: memorySourceSchema,
  /** null for facts the author added */
  chapter: chapterRef.nullable(),
});

export const storyEntitySchema = z.object({
  id: z.uuid(),
  kind: entityKindSchema,
  name: z.string(),
  aliases: z.array(z.string()),
  description: z.string(),
  pinned: z.boolean(),
  source: memorySourceSchema,
  facts: z.array(storyFactSchema),
  appearances: z.array(chapterRef.extend({ excerpt: z.string() })),
});

const conflictSide = z.object({ value: z.string(), chapter: chapterRef.nullable() });

export const consistencyWarningSchema = z.object({
  id: z.uuid(),
  entityId: z.uuid(),
  entityName: z.string(),
  attribute: z.string(),
  explanation: z.string(),
  /** The newer detail and the one it contradicts */
  fact: conflictSide,
  conflictingFact: conflictSide,
});

export const memoryStatusSchema = z.object({
  /** False when the server has no AI provider configured */
  enabled: z.boolean(),
  /** Chapters with text Story Memory hasn't read yet */
  pendingChapters: z.int().nonnegative(),
});

export const storyBibleSchema = z.object({
  entities: z.array(storyEntitySchema),
  warnings: z.array(consistencyWarningSchema),
  status: memoryStatusSchema,
});

export const createEntityInputSchema = z.object({
  kind: entityKindSchema,
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional(),
});

export const updateEntityInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  pinned: z.boolean().optional(),
});

export const createFactInputSchema = z.object({
  attribute: z.string().trim().min(1, "Detail is required").max(60),
  value: z.string().trim().min(1, "Value is required").max(200),
});

export type EntityKind = z.infer<typeof entityKindSchema>;
export type StoryFact = z.infer<typeof storyFactSchema>;
export type StoryEntity = z.infer<typeof storyEntitySchema>;
export type ConsistencyWarning = z.infer<typeof consistencyWarningSchema>;
export type StoryBible = z.infer<typeof storyBibleSchema>;
export type CreateEntityInput = z.infer<typeof createEntityInputSchema>;
export type UpdateEntityInput = z.infer<typeof updateEntityInputSchema>;
export type CreateFactInput = z.infer<typeof createFactInputSchema>;
