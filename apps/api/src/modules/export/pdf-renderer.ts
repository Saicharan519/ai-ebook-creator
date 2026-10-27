import PDFDocument from "pdfkit";
import { chapterHeading, type ExportBook } from "./export-book";
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
const TOC = { rowHeight: 20, firstPageRows: 26, rowsPerPage: 30, fontSize: 11 };

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

  // The contents list needs page numbers that aren't known yet, so reserve its
  // pages now and fill them in once every chapter has been laid out
  const headings = book.chapters.map(chapterHeading);
  const tocStart = doc.bufferedPageRange().count;
  const tocPages = tocPageCount(headings.length);
  for (let i = 0; i < tocPages; i++) doc.addPage();

  const firstChapterPage = doc.bufferedPageRange().count;
  const chapterPages: number[] = [];
  book.chapters.forEach((chapter, index) => {
    doc.addPage();
    chapterPages.push(doc.bufferedPageRange().count - 1);
    // A named destination for the contents links, and an entry in the reader's sidebar
    doc.addNamedDestination(`chapter-${index + 1}`);
    doc.outline.addItem(headings[index]!);
    doc.font(FONTS.heading).fontSize(SIZE.chapter).fillColor(COLORS.heading).text(headings[index]!);
    doc.moveDown(1.5);
    for (const block of parseMarkdown(chapter.content)) {
      drawBlock(doc, block);
    }
  });

  drawContents(doc, headings, tocStart, (index) => chapterPages[index]! - firstChapterPage + 1);
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

function tocPageCount(entries: number): number {
  if (entries <= TOC.firstPageRows) return 1;
  return 1 + Math.ceil((entries - TOC.firstPageRows) / TOC.rowsPerPage);
}

/** Fills the reserved pages with chapter titles, dot leaders, and page numbers, each a link. */
function drawContents(
  doc: Pdf,
  headings: string[],
  firstPage: number,
  pageNumberOf: (index: number) => number,
) {
  const left = MARGIN;
  const right = doc.page.width - MARGIN;
  const numberWidth = 40;
  let pageIndex = firstPage;
  let row = 0;
  let y = 0;

  const startPage = (first: boolean) => {
    doc.switchToPage(pageIndex);
    y = MARGIN;
    if (first) {
      doc.font(FONTS.heading).fontSize(SIZE.chapter).fillColor(COLORS.heading);
      doc.text("Contents", left, y);
      y = doc.y + 24;
    }
  };
  startPage(true);

  headings.forEach((heading, index) => {
    const capacity = pageIndex === firstPage ? TOC.firstPageRows : TOC.rowsPerPage;
    if (row === capacity) {
      pageIndex += 1;
      row = 0;
      startPage(false);
    }

    doc.font(FONTS.body).fontSize(TOC.fontSize).fillColor(COLORS.text);
    const pageNumber = String(pageNumberOf(index));
    const title = fitText(doc, heading, right - left - numberWidth - 12);
    const titleEnd = left + doc.widthOfString(title) + 4;
    const numberStart = right - doc.widthOfString(pageNumber);

    doc.text(title, left, y, { lineBreak: false });
    const dots = fitText(doc, ".".repeat(200), numberStart - titleEnd - 4, false);
    doc.fillColor(COLORS.rule).text(dots, titleEnd, y, { lineBreak: false });
    doc.fillColor(COLORS.text).text(pageNumber, numberStart, y, { lineBreak: false });
    doc.goTo(left, y, right - left, TOC.rowHeight - 4, `chapter-${index + 1}`);

    y += TOC.rowHeight;
    row += 1;
  });
}

/** Shortens text to fit a width, adding an ellipsis when something was cut */
function fitText(doc: Pdf, text: string, width: number, ellipsis = true): string {
  if (doc.widthOfString(text) <= width) return text;
  const suffix = ellipsis ? "…" : "";
  let end = text.length;
  while (end > 0 && doc.widthOfString(text.slice(0, end) + suffix) > width) end -= 1;
  return text.slice(0, end).trimEnd() + suffix;
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

/** Numbers every chapter page at the bottom center; cover, title, and contents pages stay unnumbered. */
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
