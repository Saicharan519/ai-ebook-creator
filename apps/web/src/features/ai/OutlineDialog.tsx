import { MAX_OUTLINE_CHAPTERS, type Book, type OutlineChapter } from "@ebook/shared";
import { Sparkles, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { TextAreaField, TextField } from "../../components/ui/TextField";
import { errorMessage } from "../../lib/form-errors";
import { useAddChapters, useGenerateOutline } from "./ai-api";

const FORM_ID = "outline-form";

/** Asks the AI for a chapter plan, lets the author trim it, then adds the chapters. */
export function OutlineDialog({
  book,
  open,
  onClose,
  onAdded,
}: {
  book: Book;
  open: boolean;
  onClose: () => void;
  /** Called with the id of the first new chapter */
  onAdded: (chapterId: string) => void;
}) {
  const generate = useGenerateOutline(book.id);
  const addChapters = useAddChapters(book.id);
  const [outline, setOutline] = useState<OutlineChapter[] | null>(null);

  // Starting fresh is only offered while no chapter has any text
  const startingFresh = book.chapters.every((chapter) => chapter.wordCount === 0);

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const guidance = (form.get("guidance") as string).trim();
    generate.mutate(
      { chapterCount: Number(form.get("chapterCount")), guidance: guidance || undefined },
      { onSuccess: (result) => setOutline(result.chapters) },
    );
  }

  function handleAdd() {
    if (!outline?.length) return;
    const existingCount = startingFresh ? 0 : book.chapters.length;
    addChapters.mutate(
      { chapters: outline, replaceEmpty: startingFresh },
      {
        onSuccess: (chapters) => {
          const first = chapters[existingCount];
          close();
          if (first) onAdded(first.id);
        },
      },
    );
  }

  function close() {
    setOutline(null);
    generate.reset();
    addChapters.reset();
    onClose();
  }

  const error = generate.error ?? addChapters.error;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Plan chapters with AI"
      size="lg"
      footer={
        outline ? (
          <>
            <Button variant="secondary" onClick={() => setOutline(null)}>
              Start over
            </Button>
            <Button onClick={handleAdd} loading={addChapters.isPending} disabled={!outline.length}>
              Add {outline.length} chapters
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} loading={generate.isPending}>
              {!generate.isPending && <Sparkles className="h-4 w-4" />}
              Generate outline
            </Button>
          </>
        )
      }
    >
      {outline ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            {startingFresh
              ? "These chapters will replace your empty starter chapter."
              : "These chapters will be added after your existing ones."}{" "}
            Remove any you don't want.
          </p>
          <ol className="space-y-2">
            {outline.map((chapter, index) => (
              <li key={index} className="flex gap-3 rounded-lg border border-stone-200 px-3 py-2.5">
                <span className="text-sm text-stone-400">{index + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-900">{chapter.title}</p>
                  <p className="text-sm text-stone-600">{chapter.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOutline(outline.filter((_, i) => i !== index))}
                  aria-label={`Remove ${chapter.title}`}
                  className="self-start rounded p-1 text-stone-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <form id={FORM_ID} onSubmit={handleGenerate} className="space-y-4">
          {!book.premise && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Tip: add a premise in the book details first. The outline is built from it.
            </p>
          )}
          <TextField
            label="Number of chapters"
            name="chapterCount"
            type="number"
            min={1}
            max={MAX_OUTLINE_CHAPTERS}
            defaultValue={10}
            required
          />
          <TextAreaField
            label="Anything the outline should include?"
            name="guidance"
            maxLength={2000}
            placeholder="e.g. a betrayal halfway through, an open ending"
            hint="Optional"
          />
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage(error)}
        </p>
      )}
    </Modal>
  );
}
