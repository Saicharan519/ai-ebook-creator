import {
  countWords,
  INLINE_ACTION_LABELS,
  type Branch,
  type Chapter,
  type InlineAction,
} from "@ebook/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { PenLine, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "../../components/ui/Button";
import { pluralize } from "../../lib/format";
import { AiSelectionMenu } from "../ai/AiSelectionMenu";
import { SuggestionPanel } from "../ai/SuggestionPanel";
import { useAiSuggestion } from "../ai/use-ai-suggestion";
import { bookKeys, saveChapter } from "../books/books-api";
import { saveBranch, saveVersion, versionKeys } from "../versions/versions-api";
import { EditorToolbar } from "./EditorToolbar";
import { useAutosave, type SaveStatus } from "./use-autosave";

interface Draft {
  title: string;
  content: string;
}

const sameDraft = (a: Draft, b: Draft) => a.title === b.title && a.content === b.content;

// Must stay within the API's limits for inline requests
const CONTEXT_LIMITS = { selection: 10_000, before: 20_000, after: 5_000 };

/** Where an accepted suggestion goes: replaces [from, to] (an insert when from === to). */
interface SuggestionTarget {
  from: number;
  to: number;
  title: string;
  acceptLabel: string;
}

interface ChapterEditorProps {
  bookId: string;
  chapter: Chapter;
  /** Edit this what-if branch's text instead of the main text */
  branch: Branch | null;
  onStatusChange: (status: SaveStatus) => void;
  /** Lets the page save pending changes before exporting */
  flushRef: RefObject<(() => Promise<void>) | null>;
}

/**
 * Edits one chapter's main text or one of its what-if branches. Mount with a key
 * per chapter and branch so each gets fresh state.
 */
export function ChapterEditor({
  bookId,
  chapter,
  branch,
  onStatusChange,
  flushRef,
}: ChapterEditorProps) {
  const queryClient = useQueryClient();
  const initialContent = branch ? branch.content : chapter.content;
  const [draft, setDraft] = useState<Draft>({ title: chapter.title, content: initialContent });
  const suggestion = useAiSuggestion();
  const [target, setTarget] = useState<SuggestionTarget | null>(null);
  const [versionSaved, setVersionSaved] = useState(false);
  const accepting = useRef(false);
  const branchId = branch?.id ?? null;

  const updateDraft = useCallback(
    (change: Partial<Draft>) => {
      setDraft((current) => ({ ...current, ...change }));
      // Keep the cached text current, so switching away and back shows the
      // latest text even if the save is still in flight
      if (branchId) {
        if (change.content === undefined) return;
        queryClient.setQueryData<Branch>(
          versionKeys.branch(bookId, chapter.id, branchId),
          (cached) => (cached ? { ...cached, content: change.content! } : cached),
        );
        return;
      }
      queryClient.setQueryData<Chapter>(bookKeys.chapter(bookId, chapter.id), (cached) =>
        cached ? { ...cached, ...change } : cached,
      );
    },
    [queryClient, bookId, chapter.id, branchId],
  );

  const { status, flush } = useAutosave({
    value: draft,
    isEqual: sameDraft,
    save: (value) =>
      branchId
        ? saveBranch(queryClient, bookId, chapter.id, branchId, value.content)
        : saveChapter(queryClient, bookId, chapter.id, value),
  });

  // Ctrl+S (Cmd+S on a Mac) saves a version to come back to
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    async function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      await flush();
      await saveVersion(queryClient, bookId, chapter.id, {
        reason: "manual",
        branchId: branchId ?? undefined,
      });
      setVersionSaved(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setVersionSaved(false), 2_000);
    }
    const listener = (event: KeyboardEvent) => void handleKeyDown(event).catch(() => {});
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      clearTimeout(hideTimer);
    };
  }, [flush, queryClient, bookId, chapter.id, branchId]);

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
    content: initialContent,
    contentType: "markdown",
    editorProps: {
      attributes: { class: "chapter-prose min-h-[50vh] focus:outline-none", spellcheck: "true" },
    },
    onUpdate: ({ editor }) => updateDraft({ content: editor.getMarkdown() }),
  });

  const aiBase = `/books/${bookId}/chapters/${chapter.id}/ai`;

  /**
   * Locks the editor while a suggestion is open, so the positions it will
   * replace can't shift underneath it.
   */
  function beginSuggestion(editor: Editor, next: SuggestionTarget, path: string, body: unknown) {
    editor.setEditable(false);
    setTarget(next);
    void suggestion.start({ path, body });
  }

  function runInlineAction(action: InlineAction, tone?: string) {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const doc = editor.state.doc;
    const selection = doc.textBetween(from, to, "\n\n");

    if (selection.length > CONTEXT_LIMITS.selection) {
      window.alert("That selection is too long. Select up to about 1,500 words.");
      return;
    }

    beginSuggestion(
      editor,
      {
        from: action === "continue" ? to : from,
        to,
        title: action === "tone" ? `Change tone: ${tone}` : INLINE_ACTION_LABELS[action],
        acceptLabel: action === "continue" ? "Insert" : "Replace selection",
      },
      `${aiBase}/inline`,
      {
        action,
        tone,
        selection,
        before: doc.textBetween(0, from, "\n\n").slice(-CONTEXT_LIMITS.before),
        after: doc.textBetween(to, doc.content.size, "\n\n").slice(0, CONTEXT_LIMITS.after),
      },
    );
  }

  async function draftChapter() {
    if (!editor) return;
    // The draft is based on the saved title, so save any pending edits first
    await flush();
    const empty = editor.isEmpty;
    beginSuggestion(
      editor,
      {
        from: empty ? 0 : editor.state.doc.content.size,
        to: editor.state.doc.content.size,
        title: "Chapter draft",
        acceptLabel: empty ? "Use draft" : "Add to end",
      },
      `${aiBase}/draft`,
      {},
    );
  }

  function closeSuggestion() {
    suggestion.reset();
    setTarget(null);
    editor?.setEditable(true);
  }

  async function acceptSuggestion() {
    if (!editor || !target || suggestion.state.status === "idle" || accepting.current) return;
    accepting.current = true;
    const text = suggestion.state.text.trim();
    const { from, to } = target;

    // Keep the text from before the AI change in History. The editor stays locked
    // meanwhile, so the positions above still point at the right place.
    try {
      await flush();
      await saveVersion(queryClient, bookId, chapter.id, {
        reason: "before_ai",
        branchId: branchId ?? undefined,
      });
    } catch {
      // History is a safety net; failing to save it shouldn't block the author's choice
    }

    accepting.current = false;
    closeSuggestion();
    editor.chain().focus().insertContentAt({ from, to }, text, { contentType: "markdown" }).run();
  }

  const busy = suggestion.state.status !== "idle";

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
        // A branch is an alternative text; the title belongs to the chapter
        readOnly={branchId !== null}
        title={branchId ? "Switch to the main text to rename the chapter" : undefined}
        className="w-full bg-transparent font-serif text-3xl font-semibold text-stone-900 placeholder:text-stone-300 focus:outline-none"
      />
      <p className="mt-1 text-xs text-stone-500">
        {pluralize(countWords(draft.content), "word")}
        {versionSaved && (
          <span role="status" className="ml-2 text-emerald-700">
            Version saved
          </span>
        )}
      </p>

      {editor && (
        <div className="sticky top-0 z-[5] mt-4 flex flex-wrap items-center gap-2 bg-white/95 py-2 backdrop-blur">
          <EditorToolbar editor={editor} />
          <div className="flex gap-1">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => runInlineAction("continue")}
              title="Continue writing from the cursor"
            >
              <Sparkles className="h-4 w-4 text-violet-600" />
              Continue
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void draftChapter()}
              title="Draft this chapter from its title and the book's outline"
            >
              <PenLine className="h-4 w-4 text-violet-600" />
              Draft chapter
            </Button>
          </div>
        </div>
      )}

      {editor && <AiSelectionMenu editor={editor} onAction={runInlineAction} />}
      <EditorContent editor={editor} className="mt-4" />

      {target && suggestion.state.status !== "idle" && (
        <SuggestionPanel
          title={target.title}
          acceptLabel={target.acceptLabel}
          state={suggestion.state}
          onAccept={() => void acceptSuggestion()}
          onDiscard={closeSuggestion}
          onRetry={suggestion.retry}
          onStop={suggestion.stop}
        />
      )}
    </div>
  );
}
