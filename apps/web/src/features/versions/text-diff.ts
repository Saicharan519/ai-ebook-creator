import { countWords } from "@ebook/shared";
import { diffWords } from "diff";

export interface DiffSegment {
  kind: "same" | "added" | "removed";
  text: string;
}

export interface TextDiff {
  segments: DiffSegment[];
  wordsAdded: number;
  wordsRemoved: number;
}

/** Unchanged text longer than this is shortened to its ends, so the changes stand out */
const CONTEXT_CHARS = 160;
/** Large rewrites are slow to diff word by word; give up rather than freeze the page */
const DIFF_TIMEOUT_MS = 1_000;

function collapse(text: string, first: boolean, last: boolean): string {
  if (text.length <= CONTEXT_CHARS * 2) return text;
  const head = first ? "" : text.slice(0, CONTEXT_CHARS);
  const tail = last ? "" : text.slice(-CONTEXT_CHARS);
  return `${head} … ${tail}`.trim();
}

/** Word-level changes from `before` to `after`, or null if the texts are too different to compare. */
export function diffText(before: string, after: string): TextDiff | null {
  const changes = diffWords(before, after, { timeout: DIFF_TIMEOUT_MS });
  if (!changes) return null;

  let wordsAdded = 0;
  let wordsRemoved = 0;
  const segments = changes.map((change, i): DiffSegment => {
    if (change.added) {
      wordsAdded += countWords(change.value);
      return { kind: "added", text: change.value };
    }
    if (change.removed) {
      wordsRemoved += countWords(change.value);
      return { kind: "removed", text: change.value };
    }
    return { kind: "same", text: collapse(change.value, i === 0, i === changes.length - 1) };
  });

  return { segments, wordsAdded, wordsRemoved };
}
