import PDFDocument from "pdfkit";
import type { ExportBook } from "./export-book";
import { parseMarkdown, type Block, type Inline } from "./markdown-blocks";

// pdfkit's built-in fonts; they cover Latin text. Other scripts need an embedded font (future work).
const FONTS = {
  body: "Times-Roman",
  bold: "Times-Bold",
  italic: "Times-Italic",
  boldItalic: "Times-BoldItalic",
  heading: "Helvetica-Bold",
  headingRegular: "Helvetica",
  code: "Courier",
};
const SIZE = { title: 28, subtitle: 16, author: 16, chapter: 22, body: 11, code: 9 };
const HEADING_SIZES = [18, 16, 14, 13, 12, 12];
const COLORS = { text: "#333333", heading: "#1A1A1A", muted: "#555555", rule: "#CCCCCC" };
const INDENT_PER_LEVEL = 18;
const MARGIN = 72;

type Pdf = PDFKit.PDFDocument;

export function renderPdf(book: ExportBook): Promise<Buffer> {
  const doc = new PDFDocument({
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: { Title: book.title, Author: book.author },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  if (book.cover) {
    const width = doc.page.width - MARGIN * 2;
    const height = doc.page.height - MARGIN * 2;
    doc.image(book.cover.data, MARGIN, MARGIN, {
      fit: [width, height],
      align: "center",
      valign: "center",
    });
    doc.addPage();
  }

  drawTitlePage(doc, book);

  const firstChapterPage = doc.bufferedPageRange().count;
  book.chapters.forEach((chapter, index) => {
    doc.addPage();
    doc
      .font(FONTS.heading)
      .fontSize(SIZE.chapter)
      .fillColor(COLORS.heading)
      .text(chapter.title || `Chapter ${index + 1}`);
    doc.moveDown(1.5);
    for (const block of parseMarkdown(chapter.content)) {
      drawBlock(doc, block);
    }
  });

  addPageNumbers(doc, firstChapterPage);
  doc.end();
  return done;
}

function drawTitlePage(doc: Pdf, book: ExportBook) {
  doc.moveDown(8);
  doc.font(FONTS.heading).fontSize(SIZE.title).fillColor(COLORS.heading);
  doc.text(book.title, { align: "center" });
  doc.moveDown(1.5);
  if (book.subtitle) {
    doc.font(FONTS.headingRegular).fontSize(SIZE.subtitle).fillColor(COLORS.muted);
    doc.text(book.subtitle, { align: "center" });
    doc.moveDown(1);
  }
  doc.font(FONTS.headingRegular).fontSize(SIZE.author).fillColor(COLORS.muted);
  doc.text(`by ${book.author}`, { align: "center" });
}

function drawBlock(doc: Pdf, block: Block) {
  const left = doc.page.margins.left;

  switch (block.kind) {
    case "heading":
      doc.moveDown(0.6);
      drawInlines(doc, block.inlines, {
        size: HEADING_SIZES[Math.min(block.level, 6) - 1]!,
        color: COLORS.heading,
        headingFont: true,
        align: "left",
      });
      doc.moveDown(0.4);
      break;

    case "paragraph": {
      const indent = (block.indent + (block.quote ? 1 : 0)) * INDENT_PER_LEVEL;
      const top = doc.y;
      drawInlines(doc, block.inlines, {
        size: SIZE.body,
        color: block.quote ? COLORS.muted : COLORS.text,
        italic: block.quote,
        align: "justify",
        x: left + indent,
      });
      if (block.quote) {
        doc
          .moveTo(left + indent - 8, top)
          .lineTo(left + indent - 8, doc.y)
          .strokeColor(COLORS.rule)
          .lineWidth(2)
          .stroke();
      }
      doc.moveDown(0.6);
      break;
    }

    case "listItem": {
      const x = left + block.indent * INDENT_PER_LEVEL;
      const top = doc.y;
      doc.font(FONTS.body).fontSize(SIZE.body).fillColor(COLORS.text);
      doc.text(block.marker, x - 14, top, { width: 14, lineBreak: false });
      doc.y = top;
      drawInlines(doc, block.inlines, { size: SIZE.body, color: COLORS.text, align: "left", x });
      doc.moveDown(0.25);
      break;
    }

    case "code":
      doc.moveDown(0.4);
      doc.font(FONTS.code).fontSize(SIZE.code).fillColor(COLORS.text);
      doc.text(block.text, left + INDENT_PER_LEVEL, doc.y, { align: "left" });
      doc.moveDown(0.6);
      break;

    case "rule": {
      doc.moveDown(0.5);
      const y = doc.y;
      doc
        .moveTo(left, y)
        .lineTo(doc.page.width - doc.page.margins.right, y)
        .strokeColor(COLORS.rule)
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.5);
      break;
    }
  }
}

interface InlineStyle {
  size: number;
  color: string;
  align: "left" | "justify";
  italic?: boolean;
  headingFont?: boolean;
  x?: number;
}

/** Writes styled runs as one flowing paragraph using pdfkit's `continued` text. */
function drawInlines(doc: Pdf, inlines: Inline[], style: InlineStyle) {
  const x = style.x ?? doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.right - x;
  doc.fontSize(style.size).fillColor(style.color);

  // Hard line breaks become "\n" inside the run text
  const parts = inlines.flatMap((inline) =>
    inline.kind === "break"
      ? [{ text: "\n", font: fontFor(false, style.italic ?? false, false, style) }]
      : [
          {
            text: inline.text,
            font: fontFor(
              inline.bold,
              inline.italic || (style.italic ?? false),
              inline.code,
              style,
            ),
          },
        ],
  );

  if (parts.length === 0) {
    doc.text("", x, doc.y);
    return;
  }

  // pdfkit drops a run's leading space after a font change ("fast over" -> "fastover"),
  // so move leading spaces onto the end of the previous run, where they survive
  for (let i = 1; i < parts.length; i++) {
    const leading = /^\s+/.exec(parts[i]!.text)?.[0];
    if (leading && parts[i - 1]!.text !== "\n") {
      parts[i - 1]!.text += leading;
      parts[i]!.text = parts[i]!.text.slice(leading.length);
    }
  }
  // Empty runs left behind would add stray spacing
  const runsToDraw = parts.filter((part) => part.text !== "");

  runsToDraw.forEach((part, i) => {
    const isFirst = i === 0;
    doc.font(part.font);
    const options = { width, align: style.align, continued: i < runsToDraw.length - 1, lineGap: 2 };
    if (isFirst) {
      doc.text(part.text, x, doc.y, options);
    } else {
      doc.text(part.text, options);
    }
  });
}

function fontFor(bold: boolean, italic: boolean, code: boolean, style: InlineStyle): string {
  if (code) return FONTS.code;
  if (style.headingFont) return FONTS.heading;
  if (bold && italic) return FONTS.boldItalic;
  if (bold) return FONTS.bold;
  if (italic) return FONTS.italic;
  return FONTS.body;
}

/** Numbers every chapter page at the bottom center; cover and title pages stay unnumbered. */
function addPageNumbers(doc: Pdf, firstChapterPage: number) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = firstChapterPage; i < start + count; i++) {
    doc.switchToPage(i);
    // Writing inside the bottom margin would otherwise make pdfkit start a new page
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font(FONTS.body)
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(String(i - firstChapterPage + 1), 0, doc.page.height - MARGIN / 2, {
        width: doc.page.width,
        align: "center",
        lineBreak: false,
      });
    doc.page.margins.bottom = bottom;
  }
}
