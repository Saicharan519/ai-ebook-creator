import { describe, expect, it } from "vitest";
import { parseMarkdown, type Inline } from "../src/modules/export/markdown-blocks";

const text = (
  value: string,
  style: Partial<{ bold: boolean; italic: boolean; code: boolean }> = {},
) => ({ kind: "text", text: value, bold: false, italic: false, code: false, ...style }) as Inline;

describe("parseMarkdown", () => {
  it("parses headings with their level", () => {
    expect(parseMarkdown("## Part Two")).toEqual([
      { kind: "heading", level: 2, inlines: [text("Part Two")] },
    ]);
  });

  it("splits a paragraph into formatted runs without losing spaces", () => {
    const [block] = parseMarkdown("plain **bold** *italic* `code` end");

    expect(block).toEqual({
      kind: "paragraph",
      indent: 0,
      quote: false,
      inlines: [
        text("plain "),
        text("bold", { bold: true }),
        text(" "),
        text("italic", { italic: true }),
        text(" "),
        text("code", { code: true }),
        text(" end"),
      ],
    });
  });

  it("turns a single newline into a space instead of joining words", () => {
    const [block] = parseMarkdown("line one\nline two");
    expect(block).toMatchObject({ inlines: [text("line one line two")] });
  });

  it("keeps hard line breaks", () => {
    const [block] = parseMarkdown("line one  \nline two");
    expect(block).toMatchObject({
      inlines: [text("line one"), { kind: "break" }, text("line two")],
    });
  });

  it("numbers ordered lists from their start value and indents nested lists", () => {
    const blocks = parseMarkdown("3. Three\n4. Four\n   - Nested");

    expect(blocks).toEqual([
      { kind: "listItem", marker: "3.", indent: 1, inlines: [text("Three")] },
      { kind: "listItem", marker: "4.", indent: 1, inlines: [text("Four")] },
      { kind: "listItem", marker: "•", indent: 2, inlines: [text("Nested")] },
    ]);
  });

  it("marks blockquote paragraphs and keeps their formatting", () => {
    const [block] = parseMarkdown("> a **bold** quote");
    expect(block).toMatchObject({
      kind: "paragraph",
      quote: true,
      inlines: [text("a "), text("bold", { bold: true }), text(" quote")],
    });
  });

  it("parses code blocks and horizontal rules", () => {
    expect(parseMarkdown("```\nline 1\nline 2\n```\n\n---")).toEqual([
      { kind: "code", text: "line 1\nline 2" },
      { kind: "rule" },
    ]);
  });

  it("treats raw HTML as plain text", () => {
    const [block] = parseMarkdown("<script>alert(1)</script>");
    expect(block).toMatchObject({
      kind: "paragraph",
      inlines: [text("<script>alert(1)</script>")],
    });
  });

  it("returns nothing for empty content", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("   \n\n  ")).toEqual([]);
  });
});
