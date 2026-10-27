import type { VersionReason, VersionSummary } from "@ebook/shared";
import { GitBranch, History, RotateCcw, Save, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { cn } from "../../lib/cn";
import { errorMessage } from "../../lib/form-errors";
import { pluralize, timeAgo } from "../../lib/format";
import { diffText } from "./text-diff";
import {
  useCreateBranch,
  useRestoreVersion,
  useSaveVersion,
  useVersion,
  useVersions,
} from "./versions-api";

const REASON_LABELS: Record<VersionReason, string> = {
  manual: "Saved by you",
  autosave: "Autosave",
  before_ai: "Before an AI change",
  before_restore: "Before a restore",
  before_keep: "Before keeping a branch",
};

interface HistoryPanelProps {
  bookId: string;
  chapterId: string;
  /** The what-if branch being edited, or null for the main text */
  branch: { id: string; name: string } | null;
  /** The text in the editor right now, to compare versions against */
  currentContent: string;
  /** Saves pending edits, so snapshots and restores see the latest text */
  flushPending: () => Promise<void>;
  /** The editor must reload: its text was replaced */
  onRestored: () => void;
  onOpenBranch: (branchId: string) => void;
  onClose: () => void;
}

/** Saved versions of the chapter (or branch) being edited, with diffs and restore. */
export function HistoryPanel({
  bookId,
  chapterId,
  branch,
  currentContent,
  flushPending,
  onRestored,
  onOpenBranch,
  onClose,
}: HistoryPanelProps) {
  const versions = useVersions(bookId, chapterId, branch?.id ?? null);
  const saveVersion = useSaveVersion(bookId, chapterId);
  const [label, setLabel] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    await flushPending();
    saveVersion.mutate(
      { reason: "manual", label: label.trim() || undefined, branchId: branch?.id },
      { onSuccess: () => setLabel("") },
    );
  }

  return (
    <section aria-label="Version history" className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
        <History className="h-4 w-4 text-violet-600" />
        <h2 className="flex-1 text-sm font-semibold text-stone-900">
          History
          <span className="ml-1 font-normal text-stone-500">
            · {branch ? branch.name : "Main text"}
          </span>
        </h2>
        <Button variant="ghost" size="icon" aria-label="Close history" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      <form onSubmit={(e) => void handleSave(e)} className="border-b border-stone-200 p-4">
        <label htmlFor="version-label" className="text-xs font-medium text-stone-600">
          Save a version you can come back to
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="version-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
            placeholder="Label (optional)"
            className="min-w-0 flex-1 rounded-md border border-stone-300 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
          />
          <Button type="submit" size="sm" loading={saveVersion.isPending}>
            {!saveVersion.isPending && <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
        {saveVersion.isError && (
          <p role="alert" className="mt-1.5 text-xs text-red-600">
            {errorMessage(saveVersion.error)}
          </p>
        )}
        <p className="mt-1.5 text-xs text-stone-500">
          Tip: Ctrl+S saves a version too. Autosave keeps one every 10 minutes.
        </p>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {versions.isPending ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-5 w-5 text-violet-600" />
          </div>
        ) : versions.isError ? (
          <p role="alert" className="m-4 text-sm text-red-600">
            Couldn't load the history. {errorMessage(versions.error)}
          </p>
        ) : versions.data.length === 0 ? (
          <p className="p-4 text-sm text-stone-600">
            No versions yet. They appear as you write, or when you save one.
          </p>
        ) : (
          <ol className="divide-y divide-stone-200">
            {versions.data.map((version) => (
              <VersionItem
                key={version.id}
                bookId={bookId}
                chapterId={chapterId}
                version={version}
                expanded={selectedId === version.id}
                onToggle={() => setSelectedId((id) => (id === version.id ? null : version.id))}
                currentContent={currentContent}
                flushPending={flushPending}
                onRestored={() => {
                  setSelectedId(null);
                  onRestored();
                }}
                onOpenBranch={onOpenBranch}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

interface VersionItemProps {
  bookId: string;
  chapterId: string;
  version: VersionSummary;
  expanded: boolean;
  onToggle: () => void;
  currentContent: string;
  flushPending: () => Promise<void>;
  onRestored: () => void;
  onOpenBranch: (branchId: string) => void;
}

function VersionItem({
  bookId,
  chapterId,
  version,
  expanded,
  onToggle,
  currentContent,
  flushPending,
  onRestored,
  onOpenBranch,
}: VersionItemProps) {
  const detailsId = `version-${version.id}`;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className={cn(
          "w-full px-4 py-3 text-left hover:bg-stone-100",
          expanded && "bg-violet-50 hover:bg-violet-50",
        )}
      >
        <span className="block text-sm font-medium text-stone-900">
          {version.label || REASON_LABELS[version.reason]}
        </span>
        <span className="mt-0.5 block text-xs text-stone-500">
          {version.label && `${REASON_LABELS[version.reason]} · `}
          <time dateTime={version.createdAt} title={new Date(version.createdAt).toLocaleString()}>
            {timeAgo(version.createdAt)}
          </time>
          {" · "}
          {pluralize(version.wordCount, "word")}
        </span>
      </button>
      {expanded && (
        <VersionDetails
          id={detailsId}
          bookId={bookId}
          chapterId={chapterId}
          versionId={version.id}
          currentContent={currentContent}
          flushPending={flushPending}
          onRestored={onRestored}
          onOpenBranch={onOpenBranch}
        />
      )}
    </li>
  );
}

interface VersionDetailsProps {
  id: string;
  bookId: string;
  chapterId: string;
  versionId: string;
  currentContent: string;
  flushPending: () => Promise<void>;
  onRestored: () => void;
  onOpenBranch: (branchId: string) => void;
}

function VersionDetails({
  id,
  bookId,
  chapterId,
  versionId,
  currentContent,
  flushPending,
  onRestored,
  onOpenBranch,
}: VersionDetailsProps) {
  const version = useVersion(bookId, chapterId, versionId);
  const restore = useRestoreVersion(bookId, chapterId);
  const createBranch = useCreateBranch(bookId, chapterId);
  const content = version.data?.content;
  const diff = useMemo(
    () => (content === undefined ? undefined : diffText(content, currentContent)),
    [content, currentContent],
  );

  async function handleRestore() {
    await flushPending();
    restore.mutate(versionId, { onSuccess: onRestored });
  }

  function handleBranch() {
    const stamp = new Date(version.data!.createdAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    createBranch.mutate(
      { name: `From ${stamp}`, fromVersionId: versionId },
      { onSuccess: (branch) => onOpenBranch(branch.id) },
    );
  }

  const error = restore.error ?? createBranch.error;

  return (
    <div id={id} className="space-y-3 bg-violet-50/50 px-4 pt-1 pb-4">
      {version.isPending ? (
        <Spinner className="h-4 w-4 text-violet-600" />
      ) : version.isError ? (
        <p role="alert" className="text-xs text-red-600">
          {errorMessage(version.error)}
        </p>
      ) : (
        <>
          <DiffView diff={diff} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={restore.isPending} onClick={() => void handleRestore()}>
              {!restore.isPending && <RotateCcw className="h-4 w-4" />}
              Restore
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={createBranch.isPending}
              onClick={handleBranch}
              title="Open this version as a what-if branch, without changing your text"
            >
              {!createBranch.isPending && <GitBranch className="h-4 w-4" />}
              Branch from here
            </Button>
          </div>
          <p className="text-xs text-stone-500">
            Restoring saves your current text as a version first, so you can undo it.
          </p>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {errorMessage(error)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function DiffView({ diff }: { diff: ReturnType<typeof diffText> | undefined }) {
  if (diff === undefined) return null;
  if (diff === null) {
    return (
      <p className="text-xs text-stone-600">
        These texts are too different to compare word by word.
      </p>
    );
  }
  if (diff.wordsAdded === 0 && diff.wordsRemoved === 0) {
    return <p className="text-xs text-stone-600">Same text as now.</p>;
  }

  return (
    <div>
      <p className="text-xs text-stone-600">
        Since this version:{" "}
        <span className="text-emerald-700">+{pluralize(diff.wordsAdded, "word")}</span>,{" "}
        <span className="text-red-700">−{pluralize(diff.wordsRemoved, "word")}</span>
      </p>
      <div
        aria-label="Changes since this version"
        className="mt-2 max-h-72 overflow-y-auto rounded-md border border-stone-200 bg-white p-3 font-serif text-sm leading-relaxed whitespace-pre-wrap text-stone-700"
      >
        {diff.segments.map((segment, i) =>
          segment.kind === "added" ? (
            <ins key={i} className="bg-emerald-100 text-emerald-900 no-underline">
              {segment.text}
            </ins>
          ) : segment.kind === "removed" ? (
            <del key={i} className="bg-red-100 text-red-800">
              {segment.text}
            </del>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
      </div>
    </div>
  );
}
