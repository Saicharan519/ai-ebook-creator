import { countWords, type Chapter } from "@ebook/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useState, type RefObject } from "react";
import { pluralize } from "../../lib/format";
import { bookKeys, saveChapter } from "../books/books-api";
import { EditorToolbar } from "./EditorToolbar";
import { useAutosave, type SaveStatus } from "./use-autosave";

interface Draft {
  title: string;
  content: string;
}

const sameDraft = (a: Draft, b: Draft) => a.title === b.title && a.content === b.content;

interface ChapterEditorProps {
  bookId: string;
  chapter: Chapter;
  onStatusChange: (status: SaveStatus) => void;
  /** Lets the page save pending changes before exporting */
  flushRef: RefObject<(() => Promise<void>) | null>;
}

/** Edits one chapter. Mount with key={chapter.id} so each chapter gets fresh state. */
export function ChapterEditor({ bookId, chapter, onStatusChange, flushRef }: ChapterEditorProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>({ title: chapter.title, content: chapter.content });

  const updateDraft = useCallback(
    (change: Partial<Draft>) => {
      setDraft((current) => ({ ...current, ...change }));
      // Keep the cached chapter current, so switching away and back shows the
      // latest text even if the save is still in flight
      queryClient.setQueryData<Chapter>(bookKeys.chapter(bookId, chapter.id), (cached) =>
        cached ? { ...cached, ...change } : cached,
      );
    },
    [queryClient, bookId, chapter.id],
  );

  const { status, flush } = useAutosave({
    value: draft,
    isEqual: sameDraft,
    save: (value) => saveChapter(queryClient, bookId, chapter.id, value),
  });

  useEffect(() => onStatusChange(status), [status, onStatusChange]);
  useEffect(() => {
    flushRef.current = flush;
    return () => {
      flushRef.current = null;
    };
  }, [flush, flushRef]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Underline has no Markdown syntax, so it couldn't be saved
        underline: false,
        link: { openOnClick: false },
      }),
      Markdown,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: chapter.content,
    contentType: "markdown",
    editorProps: {
      attributes: { class: "chapter-prose min-h-[50vh] focus:outline-none", spellcheck: "true" },
    },
    onUpdate: ({ editor }) => updateDraft({ content: editor.getMarkdown() }),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <label htmlFor="chapter-title" className="sr-only">
        Chapter title
      </label>
      <input
        id="chapter-title"
        value={draft.title}
        onChange={(event) => updateDraft({ title: event.target.value })}
        placeholder="Chapter title"
        maxLength={200}
        className="w-full bg-transparent font-serif text-3xl font-semibold text-stone-900 placeholder:text-stone-300 focus:outline-none"
      />
      <p className="mt-1 text-xs text-stone-500">{pluralize(countWords(draft.content), "word")}</p>

      {editor && (
        <div className="sticky top-0 z-[5] mt-4 bg-white/95 py-2 backdrop-blur">
          <EditorToolbar editor={editor} />
        </div>
      )}
      <EditorContent editor={editor} className="mt-4" />
    </div>
  );
}
