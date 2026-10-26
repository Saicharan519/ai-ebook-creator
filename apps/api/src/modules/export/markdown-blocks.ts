import MarkdownIt, { type Token } from "markdown-it";

/**
 * A small, renderer-independent model of a chapter. The PDF and DOCX
 * exporters both draw from this, so Markdown is parsed (and tested) once.
 */
export type Inline =
  { kind: "text"; text: string; bold: boolean; italic: boolean; code: boolean } | { kind: "break" };

export type Block =
  | { kind: "heading"; level: number; inlines: Inline[] }
  /** `indent` is the list nesting depth; `quote` marks text inside a blockquote */
  | { kind: "paragraph"; inlines: Inline[]; indent: number; quote: boolean }
  /** `marker` is "•" for bullets or "3." for numbered items */
  | { kind: "listItem"; marker: string; indent: number; inlines: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "rule" };

// html: false (the default) means raw HTML in a chapter is kept as plain text, never interpreted
const md = new MarkdownIt({ html: false });

export function parseMarkdown(markdown: string): Block[] {
  const tokens = md.parse(markdown, {});
  const blocks: Block[] = [];
  const lists: { ordered: boolean; next: number }[] = [];
  let quoteDepth = 0;
  // Set by list_item_open; the item's first paragraph becomes the list item text
  let pendingMarker: string | null = null;
  let tableRow: string[] | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    switch (token.type) {
      case "heading_open": {
        blocks.push({
          kind: "heading",
          level: Number(token.tag.slice(1)),
          inlines: parseInline(tokens[i + 1]),
        });
        i += 2;
        break;
      }
      case "paragraph_open": {
        const inlines = parseInline(tokens[i + 1]);
        if (pendingMarker !== null) {
          blocks.push({ kind: "listItem", marker: pendingMarker, indent: lists.length, inlines });
          pendingMarker = null;
        } else {
          blocks.push({ kind: "paragraph", inlines, indent: lists.length, quote: quoteDepth > 0 });
        }
        i += 2;
        break;
      }
      case "bullet_list_open":
        lists.push({ ordered: false, next: 1 });
        break;
      case "ordered_list_open":
        lists.push({ ordered: true, next: Number(token.attrGet("start") ?? 1) });
        break;
      case "bullet_list_close":
      case "ordered_list_close":
        lists.pop();
        break;
      case "list_item_open": {
        const list = lists.at(-1);
        pendingMarker = list?.ordered ? `${list.next++}.` : "•";
        break;
      }
      case "list_item_close":
        // An item with no text of its own (e.g. only a nested list) still gets its marker
        if (pendingMarker !== null) {
          blocks.push({
            kind: "listItem",
            marker: pendingMarker,
            indent: lists.length,
            inlines: [],
          });
          pendingMarker = null;
        }
        break;
      case "blockquote_open":
        quoteDepth++;
        break;
      case "blockquote_close":
        quoteDepth--;
        break;
      case "fence":
      case "code_block":
        blocks.push({ kind: "code", text: token.content.replace(/\n$/, "") });
        break;
      case "hr":
        blocks.push({ kind: "rule" });
        break;
      // Tables are flattened to one line per row; enough to keep the content readable
      case "tr_open":
        tableRow = [];
        break;
      case "inline":
        if (tableRow) tableRow.push(token.content);
        break;
      case "tr_close":
        if (tableRow) {
          blocks.push({
            kind: "paragraph",
            inlines: [plain(tableRow.join(" | "))],
            indent: lists.length,
            quote: false,
          });
        }
        tableRow = null;
        break;
    }
  }

  return blocks;
}

function parseInline(token: Token | undefined): Inline[] {
  if (!token || token.type !== "inline") return [];

  const inlines: Inline[] = [];
  let bold = false;
  let italic = false;

  const pushText = (text: string, code = false) => {
    if (text === "") return;
    const last = inlines.at(-1);
    // Merge with the previous run when formatting matches, to keep output compact
    if (
      last?.kind === "text" &&
      last.bold === bold &&
      last.italic === italic &&
      last.code === code
    ) {
      last.text += text;
    } else {
      inlines.push({ kind: "text", text, bold, italic, code });
    }
  };

  for (const child of token.children ?? []) {
    switch (child.type) {
      case "text":
        pushText(child.content);
        break;
      case "code_inline":
        pushText(child.content, true);
        break;
      case "softbreak":
        // A single newline inside a paragraph is a space, not a word join
        pushText(" ");
        break;
      case "hardbreak":
        inlines.push({ kind: "break" });
        break;
      case "strong_open":
        bold = true;
        break;
      case "strong_close":
        bold = false;
        break;
      case "em_open":
        italic = true;
        break;
      case "em_close":
        italic = false;
        break;
      case "image":
        // No images inside chapters yet; keep the alt text so nothing silently disappears
        pushText(child.content);
        break;
    }
  }

  return inlines;
}

function plain(text: string): Inline {
  return { kind: "text", text, bold: false, italic: false, code: false };
}
