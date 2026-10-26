import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Check, RotateCcw, Sparkles, Square, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import type { SuggestionState } from "./use-ai-suggestion";

interface SuggestionPanelProps {
  title: string;
  state: Exclude<SuggestionState, { status: "idle" }>;
  acceptLabel: string;
  onAccept: () => void;
  onDiscard: () => void;
  onRetry: () => void;
  onStop: () => void;
}

/** Shows streamed AI text, rendered as it will look in the chapter, with accept/reject controls. */
export function SuggestionPanel({
  title,
  state,
  acceptLabel,
  onAccept,
  onDiscard,
  onRetry,
  onStop,
}: SuggestionPanelProps) {
  // A read-only editor renders the Markdown exactly like the chapter does
  const preview = useEditor({
    extensions: [StarterKit, Markdown],
    editable: false,
    content: "",
    contentType: "markdown",
    editorProps: { attributes: { class: "chapter-prose text-base" } },
  });

  useEffect(() => {
    preview?.commands.setContent(state.text, { contentType: "markdown" });
  }, [preview, state.text]);

  const streaming = state.status === "streaming";
  const hasText = state.text.trim().length > 0;

  return (
    <section
      aria-label="AI suggestion"
      aria-busy={streaming}
      className="sticky bottom-4 z-[5] mt-6 rounded-xl border border-violet-200 bg-white shadow-lg"
    >
      <header className="flex items-center gap-2 border-b border-violet-100 px-4 py-2.5">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <h3 className="text-sm font-medium text-stone-900">{title}</h3>
        <span className="text-xs text-stone-500" role="status">
          {streaming
            ? "Writing…"
            : state.status === "done" && state.stopped
              ? "Stopped"
              : state.status === "done"
                ? "Ready"
                : ""}
        </span>
      </header>

      <div className="max-h-[40vh] overflow-y-auto px-4 py-3">
        {hasText ? (
          <EditorContent editor={preview} />
        ) : streaming ? (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Spinner className="h-4 w-4" /> Thinking…
          </div>
        ) : null}
        {state.status === "error" && (
          <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.message}
          </p>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-violet-100 px-4 py-2.5">
        {streaming ? (
          <Button variant="secondary" size="sm" onClick={onStop}>
            <Square className="h-3.5 w-3.5" /> Stop
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onDiscard}>
              <X className="h-4 w-4" /> Discard
            </Button>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RotateCcw className="h-4 w-4" /> Try again
            </Button>
            <Button size="sm" onClick={onAccept} disabled={!hasText}>
              <Check className="h-4 w-4" /> {acceptLabel}
            </Button>
          </>
        )}
      </footer>
    </section>
  );
}
