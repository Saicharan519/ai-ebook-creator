import JSZip from "jszip";
import { chapterHeading, type ExportBook } from "./export-book";
import { parseMarkdown, type Block, type Inline } from "./markdown-blocks";

/**
 * Builds an EPUB 3 file by hand: it's a zip of XHTML pages plus a few XML
 * files that describe them. A toc.ncx is included too, for older e-readers
 * that predate EPUB 3's nav document.
 */

const LANGUAGE = "en";

/** Escapes text for XML. Chapter text is the author's, so it is never trusted as markup. */
export function escapeXml(text: string): string {
  return (
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      // Control characters are not allowed in XML at all
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  );
}

const STYLESHEET = `body { font-family: Georgia, serif; line-height: 1.5; margin: 0 5%; }
h1 { font-family: sans-serif; font-size: 1.6em; margin: 2em 0 1em; }
h2, h3, h4, h5, h6 { font-family: sans-serif; margin: 1.5em 0 0.5em; }
p { margin: 0 0 0.8em; text-align: justify; }
blockquote { margin: 0 0 0.8em 1.5em; padding-left: 0.8em; border-left: 2px solid #ccc; font-style: italic; color: #555; }
.list-item { text-align: left; }
pre { font-family: monospace; font-size: 0.85em; white-space: pre-wrap; margin: 1em 0 1em 1.5em; }
hr { border: none; border-top: 1px solid #ccc; width: 30%; margin: 1.5em auto; }
.title-page { text-align: center; margin-top: 30%; }
.title-page h1 { font-size: 2em; }
.subtitle, .author { font-family: sans-serif; color: #555; }
.cover { text-align: center; margin: 0; padding: 0; }
.cover img { max-width: 100%; max-height: 100%; }
nav ol { list-style: none; padding: 0; }
nav li { margin: 0.4em 0; }
`;

function page(title: string, body: string, bodyAttributes = ""): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${LANGUAGE}" lang="${LANGUAGE}">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body${bodyAttributes}>
${body}
</body>
</html>
`;
}

function inlineXhtml(inlines: Inline[]): string {
  return inlines
    .map((inline) => {
      if (inline.kind === "break") return "<br/>";
      let html = escapeXml(inline.text);
      if (inline.code) html = `<code>${html}</code>`;
      if (inline.italic) html = `<em>${html}</em>`;
      if (inline.bold) html = `<strong>${html}</strong>`;
      return html;
    })
    .join("");
}

const indentStyle = (levels: number) =>
  levels > 0 ? ` style="margin-left: ${levels * 1.5}em"` : "";

export function blockXhtml(block: Block): string {
  switch (block.kind) {
    case "heading": {
      // The chapter title is the page's h1, so Markdown headings start at h2
      const level = Math.min(block.level + 1, 6);
      return `<h${level}>${inlineXhtml(block.inlines)}</h${level}>`;
    }
    case "paragraph": {
      const paragraph = `<p${indentStyle(block.indent)}>${inlineXhtml(block.inlines)}</p>`;
      return block.quote ? `<blockquote>${paragraph}</blockquote>` : paragraph;
    }
    case "listItem":
      return `<p class="list-item"${indentStyle(block.indent)}>${escapeXml(block.marker)} ${inlineXhtml(block.inlines)}</p>`;
    case "code":
      return `<pre>${escapeXml(block.text)}</pre>`;
    case "rule":
      return "<hr/>";
  }
}

interface Item {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

const chapterFile = (index: number) => `chapter-${index + 1}.xhtml`;

/** EPUB wants this exact format, without milliseconds */
const modifiedStamp = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

export async function renderEpub(book: ExportBook): Promise<Buffer> {
  const zip = new JSZip();
  // Must be the first entry and stored uncompressed, so readers can sniff the type
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`,
  );

  const oebps = zip.folder("OEBPS")!;
  const items: Item[] = [
    { id: "style", href: "style.css", mediaType: "text/css" },
    { id: "ncx", href: "toc.ncx", mediaType: "application/x-dtbncx+xml" },
  ];
  const spine: string[] = [];
  oebps.file("style.css", STYLESHEET);

  if (book.cover) {
    const extension = book.cover.type === "jpeg" ? "jpg" : "png";
    oebps.file(`cover.${extension}`, book.cover.data);
    items.push({
      id: "cover-image",
      href: `cover.${extension}`,
      mediaType: `image/${book.cover.type}`,
      properties: "cover-image",
    });
    oebps.file(
      "cover.xhtml",
      page(
        book.title,
        `<div class="cover"><img src="cover.${extension}" alt="${escapeXml(`Cover of ${book.title}`)}"/></div>`,
        ' epub:type="cover"',
      ),
    );
    items.push({ id: "cover", href: "cover.xhtml", mediaType: "application/xhtml+xml" });
    spine.push("cover");
  }

  oebps.file(
    "title.xhtml",
    page(
      book.title,
      `<section class="title-page" epub:type="titlepage">
  <h1>${escapeXml(book.title)}</h1>
  ${book.subtitle ? `<p class="subtitle">${escapeXml(book.subtitle)}</p>` : ""}
  <p class="author">by ${escapeXml(book.author)}</p>
</section>`,
    ),
  );
  items.push({ id: "title", href: "title.xhtml", mediaType: "application/xhtml+xml" });
  spine.push("title");

  const headings = book.chapters.map(chapterHeading);
  const tocEntries = headings
    .map((heading, i) => `    <li><a href="${chapterFile(i)}">${escapeXml(heading)}</a></li>`)
    .join("\n");
  oebps.file(
    "nav.xhtml",
    page(
      "Contents",
      `<nav epub:type="toc" id="toc">
  <h1>Contents</h1>
  <ol>
${tocEntries}
  </ol>
</nav>`,
    ),
  );
  items.push({
    id: "nav",
    href: "nav.xhtml",
    mediaType: "application/xhtml+xml",
    properties: "nav",
  });
  spine.push("nav");

  book.chapters.forEach((chapter, i) => {
    const body = parseMarkdown(chapter.content).map(blockXhtml).join("\n");
    oebps.file(
      chapterFile(i),
      page(
        headings[i]!,
        `<section epub:type="chapter">\n<h1>${escapeXml(headings[i]!)}</h1>\n${body}\n</section>`,
      ),
    );
    items.push({
      id: `chapter-${i + 1}`,
      href: chapterFile(i),
      mediaType: "application/xhtml+xml",
    });
    spine.push(`chapter-${i + 1}`);
  });

  const identifier = `urn:uuid:${book.id}`;
  oebps.file("toc.ncx", tocNcx(book, identifier, headings));
  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${LANGUAGE}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${identifier}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:creator>${escapeXml(book.author)}</dc:creator>
    <dc:language>${LANGUAGE}</dc:language>
    <meta property="dcterms:modified">${modifiedStamp(book.updatedAt)}</meta>
    ${book.cover ? '<meta name="cover" content="cover-image"/>' : ""}
  </metadata>
  <manifest>
${items
  .map(
    (item) =>
      `    <item id="${item.id}" href="${item.href}" media-type="${item.mediaType}"${
        item.properties ? ` properties="${item.properties}"` : ""
      }/>`,
  )
  .join("\n")}
  </manifest>
  <spine toc="ncx">
${spine.map((id) => `    <itemref idref="${id}"/>`).join("\n")}
  </spine>
</package>
`,
  );

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    mimeType: "application/epub+zip",
  });
}

function tocNcx(book: ExportBook, identifier: string, headings: string[]): string {
  const points = headings
    .map(
      (heading, i) => `    <navPoint id="nav-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(heading)}</text></navLabel>
      <content src="${chapterFile(i)}"/>
    </navPoint>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${identifier}"/>
  </head>
  <docTitle><text>${escapeXml(book.title)}</text></docTitle>
  <navMap>
${points}
  </navMap>
</ncx>
`;
}
