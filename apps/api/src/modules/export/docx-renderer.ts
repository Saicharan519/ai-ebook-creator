import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { imageSize } from "../../lib/image-type";
import type { ExportBook } from "./export-book";
import { parseMarkdown, type Block, type Inline } from "./markdown-blocks";

const FONTS = { body: "Georgia", heading: "Calibri", code: "Courier New" };
// docx sizes are in half-points; spacing and indents in twentieths of a point
const SIZE = { title: 64, subtitle: 40, author: 36, chapter: 48, body: 24, code: 20 };
const INDENT_PER_LEVEL = 720;
const COLORS = { heading: "1A202C", muted: "4A5568", quote: "555555", rule: "CCCCCC" };

// Markdown headings sit under the chapter title, which is Heading 1
const HEADING_LEVELS = [
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
  HeadingLevel.HEADING_6,
] as const;

export async function renderDocx(book: ExportBook): Promise<Buffer> {
  const children: Paragraph[] = [...coverPage(book), ...titlePage(book)];

  book.chapters.forEach((chapter, index) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { before: 400, after: 300 },
        children: [
          new TextRun({
            text: chapter.title || `Chapter ${index + 1}`,
            bold: true,
            font: FONTS.heading,
            size: SIZE.chapter,
            color: COLORS.heading,
          }),
        ],
      }),
      ...parseMarkdown(chapter.content).map(blockToParagraph),
    );
  });

  const doc = new Document({
    creator: book.author,
    title: book.title,
    styles: { default: { document: { run: { font: FONTS.body, size: SIZE.body } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function coverPage(book: ExportBook): Paragraph[] {
  if (!book.cover) return [];

  // Fit inside 400x550 points while keeping the image's own proportions
  const size = imageSize(book.cover.data, book.cover.type) ?? { width: 400, height: 550 };
  const scale = Math.min(400 / size.width, 550 / size.height);

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          type: book.cover.type === "jpeg" ? "jpg" : "png",
          data: book.cover.data,
          transformation: {
            width: Math.round(size.width * scale),
            height: Math.round(size.height * scale),
          },
        }),
      ],
    }),
    new Paragraph({ pageBreakBefore: true, children: [] }),
  ];
}

function titlePage(book: ExportBook): Paragraph[] {
  const line = (text: string, size: number, color: string, bold = false) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text, size, color, bold, font: FONTS.heading })],
    });

  return [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    line(book.title, SIZE.title, COLORS.heading, true),
    ...(book.subtitle ? [line(book.subtitle, SIZE.subtitle, COLORS.muted)] : []),
    line(`by ${book.author}`, SIZE.author, COLORS.muted),
  ];
}

function blockToParagraph(block: Block): Paragraph {
  switch (block.kind) {
    case "heading":
      return new Paragraph({
        heading: HEADING_LEVELS[Math.min(block.level, 6) - 1],
        spacing: { before: 300, after: 150 },
        children: runs(block.inlines, { font: FONTS.heading, color: COLORS.heading }),
      });
    case "paragraph":
      return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 120, after: 120, line: 360 },
        indent: { left: (block.indent + (block.quote ? 1 : 0)) * INDENT_PER_LEVEL },
        ...(block.quote && {
          border: { left: { color: COLORS.rule, space: 8, style: BorderStyle.SINGLE, size: 12 } },
        }),
        children: runs(block.inlines, block.quote ? { italic: true, color: COLORS.quote } : {}),
      });
    case "listItem":
      return new Paragraph({
        spacing: { before: 60, after: 60 },
        indent: { left: block.indent * INDENT_PER_LEVEL, hanging: 360 },
        children: [new TextRun({ text: `${block.marker}\t` }), ...runs(block.inlines)],
      });
    case "code":
      return new Paragraph({
        spacing: { before: 200, after: 200 },
        shading: { fill: "F5F5F5" },
        children: block.text
          .split("\n")
          .map(
            (line, i) =>
              new TextRun({ text: line, font: FONTS.code, size: SIZE.code, break: i > 0 ? 1 : 0 }),
          ),
      });
    case "rule":
      return new Paragraph({
        spacing: { before: 200, after: 200 },
        border: { bottom: { color: COLORS.rule, space: 1, style: BorderStyle.SINGLE, size: 6 } },
        children: [],
      });
  }
}

function runs(
  inlines: Inline[],
  base: { font?: string; color?: string; italic?: boolean } = {},
): TextRun[] {
  return inlines.map((inline) =>
    inline.kind === "break"
      ? new TextRun({ text: "", break: 1 })
      : new TextRun({
          text: inline.text,
          bold: inline.bold,
          italics: inline.italic || base.italic,
          font: inline.code ? FONTS.code : base.font,
          color: base.color,
        }),
  );
}
