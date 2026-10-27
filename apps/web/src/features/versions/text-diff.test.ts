import { describe, expect, it } from "vitest";
import { diffText } from "./text-diff";

describe("diffText", () => {
  it("marks added and removed words and counts them", () => {
    const diff = diffText("The grey cat slept.", "The black cat slept soundly.")!;

    expect(diff.segments.filter((s) => s.kind === "removed").map((s) => s.text)).toEqual(["grey"]);
    expect(diff.segments.filter((s) => s.kind === "added").map((s) => s.text.trim())).toEqual([
      "black",
      "soundly",
    ]);
    expect(diff).toMatchObject({ wordsAdded: 2, wordsRemoved: 1 });
  });

  it("reports no changes for identical text", () => {
    const diff = diffText("Same words.", "Same words.")!;
    expect(diff.segments.every((s) => s.kind === "same")).toBe(true);
    expect(diff).toMatchObject({ wordsAdded: 0, wordsRemoved: 0 });
  });

  it("shortens long unchanged stretches to the text next to each change", () => {
    const filler = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const diff = diffText(`Start. ${filler} End.`, `Begin. ${filler} Finish.`)!;

    const middle = diff.segments.find((s) => s.kind === "same" && s.text.includes("…"))!;
    expect(middle.text.length).toBeLessThan(400);
    expect(middle.text).toContain("word0");
    expect(middle.text).toContain("word199");
  });
});
