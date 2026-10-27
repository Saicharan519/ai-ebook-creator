import type { ConsistencyWarning, EntityKind, StoryEntity } from "@ebook/shared";
import { AlertTriangle, BookMarked, Check, Plus, RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { errorMessage } from "../../lib/form-errors";
import { pluralize } from "../../lib/format";
import { EntityCard } from "./EntityCard";
import {
  useCreateEntity,
  useDismissWarning,
  useRefreshMemory,
  useStoryBible,
} from "./story-bible-api";

const GROUPS: { kind: EntityKind; label: string }[] = [
  { kind: "character", label: "Characters" },
  { kind: "place", label: "Places" },
  { kind: "item", label: "Items" },
  { kind: "group", label: "Groups" },
];

interface StoryBiblePanelProps {
  bookId: string;
  onOpenChapter: (chapterId: string) => void;
  onClose: () => void;
}

/** What Story Memory knows about the book, with contradictions to review. */
export function StoryBiblePanel({ bookId, onOpenChapter, onClose }: StoryBiblePanelProps) {
  const bible = useStoryBible(bookId, true);
  const refresh = useRefreshMemory(bookId);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (entity: StoryEntity) =>
      !needle ||
      [entity.name, ...entity.aliases, entity.description].some((text) =>
        text.toLowerCase().includes(needle),
      );
    return GROUPS.map((group) => ({
      ...group,
      entities: (bible.data?.entities ?? []).filter(
        (entity) => entity.kind === group.kind && matches(entity),
      ),
    })).filter((group) => group.entities.length > 0);
  }, [bible.data, query]);

  return (
    <section aria-label="Story Bible" className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
        <BookMarked className="h-4 w-4 text-accent-600" />
        <h2 className="flex-1 text-sm font-semibold text-stone-900">Story Bible</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Re-read the whole book"
          title="Re-read the whole book"
          disabled={refresh.isPending || !bible.data?.status.enabled}
          onClick={() => refresh.mutate()}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Close Story Bible" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      {bible.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-5 w-5 text-accent-600" />
        </div>
      ) : bible.isError ? (
        <p role="alert" className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn't load the Story Bible. {errorMessage(bible.error)}
        </p>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <MemoryStatus
            enabled={bible.data.status.enabled}
            pending={bible.data.status.pendingChapters}
          />

          {bible.data.warnings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-amber-700 uppercase">
                Possible contradictions
              </h3>
              <ul className="space-y-2">
                {bible.data.warnings.map((warning) => (
                  <WarningCard
                    key={warning.id}
                    bookId={bookId}
                    warning={warning}
                    onOpenChapter={onOpenChapter}
                  />
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search the Story Bible</span>
              <Search className="pointer-events-none absolute top-2 left-2 h-4 w-4 text-stone-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="w-full rounded-md border border-stone-300 py-1.5 pr-2 pl-8 text-sm focus:border-accent-500 focus:outline-none"
              />
            </label>
            <Button variant="secondary" size="sm" onClick={() => setAdding(!adding)}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          {adding && <AddEntryForm bookId={bookId} onDone={() => setAdding(false)} />}

          {groups.length === 0 ? (
            <p className="text-sm text-stone-500">
              {query
                ? "Nothing matches that search."
                : "Characters, places, and details will appear here as you write."}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.kind}>
                <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  {group.label} ({group.entities.length})
                </h3>
                <ul className="space-y-1.5">
                  {group.entities.map((entity) => (
                    <EntityCard
                      key={entity.id}
                      bookId={bookId}
                      entity={entity}
                      onOpenChapter={onOpenChapter}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

function MemoryStatus({ enabled, pending }: { enabled: boolean; pending: number }) {
  if (!enabled) {
    return (
      <p className="rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-600">
        Story Memory needs AI to be set up on the server.
      </p>
    );
  }
  return (
    <p role="status" className="flex items-center gap-1.5 text-xs text-stone-500">
      {pending > 0 ? (
        <>
          <Spinner className="h-3.5 w-3.5" /> Reading {pluralize(pending, "chapter")}…
        </>
      ) : (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600" /> Up to date with your chapters
        </>
      )}
    </p>
  );
}

const chapterLabel = (chapter: { position: number } | null) =>
  chapter ? `ch. ${chapter.position + 1}` : "your notes";

function WarningCard({
  bookId,
  warning,
  onOpenChapter,
}: {
  bookId: string;
  warning: ConsistencyWarning;
  onOpenChapter: (chapterId: string) => void;
}) {
  const dismiss = useDismissWarning(bookId);
  const sides = [warning.conflictingFact, warning.fact];

  return (
    <li className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
      <p className="flex items-start gap-1.5 font-medium text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {warning.entityName}: {warning.attribute}
      </p>
      <ul className="mt-1.5 space-y-0.5 pl-5 text-stone-700">
        {sides.map((side, index) => (
          <li key={index}>
            “{side.value}”{" "}
            {side.chapter ? (
              <button
                type="button"
                onClick={() => onOpenChapter(side.chapter!.id)}
                className="text-xs text-accent-700 hover:underline"
              >
                {chapterLabel(side.chapter)}
              </button>
            ) : (
              <span className="text-xs text-stone-500">{chapterLabel(null)}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 pl-5 text-xs text-stone-600">{warning.explanation}</p>
      <div className="mt-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          loading={dismiss.isPending}
          onClick={() => dismiss.mutate(warning.id)}
          title="This is intended; don't flag it again"
        >
          It's intended
        </Button>
      </div>
    </li>
  );
}

function AddEntryForm({ bookId, onDone }: { bookId: string; onDone: () => void }) {
  const create = useCreateEntity(bookId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    if (!name) return;
    create.mutate(
      {
        kind: form.get("kind") as EntityKind,
        name,
        description: String(form.get("description")).trim() || undefined,
      },
      { onSuccess: onDone },
    );
  }

  const field =
    "w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-accent-500 focus:outline-none";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-lg border border-accent-200 bg-accent-50/50 p-3"
    >
      <div className="flex gap-2">
        <select name="kind" aria-label="Kind" className={`${field} w-auto`}>
          {GROUPS.map((group) => (
            <option key={group.kind} value={group.kind}>
              {group.label.slice(0, -1)}
            </option>
          ))}
        </select>
        <input
          name="name"
          placeholder="Name"
          aria-label="Name"
          maxLength={100}
          className={field}
          autoFocus
        />
      </div>
      <textarea
        name="description"
        placeholder="Who or what is it? (optional)"
        aria-label="Description"
        maxLength={500}
        rows={2}
        className={field}
      />
      <p className="text-xs text-stone-500">Your entries are pinned: the AI always sees them.</p>
      {create.isError && (
        <p role="alert" className="text-xs text-red-600">
          {errorMessage(create.error)}
        </p>
      )}
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={create.isPending}>
          Add entry
        </Button>
      </div>
    </form>
  );
}
