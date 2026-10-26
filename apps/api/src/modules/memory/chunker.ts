/** Aim for chunks of about 300-400 tokens: big enough to carry context, small enough to be precise. */
const TARGET_CHARS = 1_500;
const MAX_CHARS = 2_500;

/**
 * Splits chapter text into passages for embedding. Paragraphs stay whole and
 * are grouped up to the target size; an oversized paragraph is split at
 * sentence ends, and only as a last resort mid-sentence.
 */
export function chunkText(markdown: string): string[] {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap(splitOversized);

  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > TARGET_CHARS) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitOversized(paragraph: string): string[] {
  if (paragraph.length <= MAX_CHARS) return [paragraph];

  const pieces: string[] = [];
  let current = "";
  for (const sentence of paragraph.split(/(?<=[.!?…"”])\s+/)) {
    if (current && current.length + sentence.length + 1 > TARGET_CHARS) {
      pieces.push(current);
      current = "";
    }
    current = current ? `${current} ${sentence}` : sentence;
    // A single "sentence" with no punctuation for thousands of characters
    while (current.length > MAX_CHARS) {
      pieces.push(current.slice(0, TARGET_CHARS));
      current = current.slice(TARGET_CHARS);
    }
  }
  if (current) pieces.push(current);
  return pieces;
}
