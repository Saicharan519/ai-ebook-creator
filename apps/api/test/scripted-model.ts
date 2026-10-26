import { FakeLlmProvider, type LlmRequest } from "../src/lib/llm";
import type { Extraction } from "../src/modules/memory/memory-prompts";

export type ExtractedEntity = Extraction["entities"][number];

export const entity = (
  name: string,
  facts: [string, string][] = [],
  extra: Partial<ExtractedEntity> = {},
): ExtractedEntity => ({
  name,
  kind: "character",
  aliases: [],
  description: `${name} in this chapter.`,
  excerpt: `${name} appears.`,
  facts: facts.map(([attribute, value]) => ({ attribute, value })),
  ...extra,
});

/**
 * A fake model that answers extraction requests from a script keyed by chapter
 * number, and judges every candidate contradiction according to `judge`.
 */
export class ScriptedMemoryModel extends FakeLlmProvider {
  script = new Map<number, Extraction>();
  judge: (pair: number) => boolean = () => true;

  constructor() {
    super({
      respond: (req: LlmRequest) => {
        if (req.task === "memory") {
          const chapter = Number(/<chapter_(\d+)>/.exec(req.prompt)?.[1]);
          return JSON.stringify(this.script.get(chapter) ?? { summary: "", entities: [] });
        }
        if (req.task === "consistency") {
          const pairs = req.prompt.match(/^\d+\. /gm)?.length ?? 0;
          return JSON.stringify({
            verdicts: Array.from({ length: pairs }, (_, i) => ({
              pair: i + 1,
              contradiction: this.judge(i + 1),
              explanation: `Pair ${i + 1} disagrees.`,
            })),
          });
        }
        return "unused";
      },
    });
  }
}
