import type { ChapterSummary } from "@ebook/shared";
import { ArrowLeft, BookMarked, Globe, History, PanelLeft, Settings2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { AppHeader } from "../components/layout/AppHeader";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Spinner } from "../components/ui/Spinner";
import { OutlineDialog } from "../features/ai/OutlineDialog";
import { BookDetailsDialog } from "../features/books/BookDetailsDialog";
import { PublishDialog } from "../features/books/PublishDialog";
import {
  useBook,
  useChapter,
  useCreateChapter,
  useDeleteChapter,
  useReorderChapters,
} from "../features/books/books-api";
import { ChapterEditor } from "../features/editor/ChapterEditor";
import { ChapterSidebar } from "../features/editor/ChapterSidebar";
import { ExportButtons } from "../features/editor/ExportButtons";
import { SaveStatusBadge } from "../features/editor/SaveStatusBadge";
import { StoryBiblePanel } from "../features/story-bible/StoryBiblePanel";
import { BranchBar } from "../features/versions/BranchBar";
import { HistoryPanel } from "../features/versions/HistoryPanel";
import { useBranch, useBranches } from "../features/versions/versions-api";
import type { SaveStatus } from "../features/editor/use-autosave";
import { ApiRequestError } from "../lib/api";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/form-errors";

export function EditorPage() {
  const { bookId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const book = useBook(bookId);
  const createChapter = useCreateChapter(bookId);
  const deleteChapter = useDeleteChapter(bookId);
  const reorderChapters = useReorderChapters(bookId);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [aside, setAside] = useState<"bible" | "history" | null>(null);
  /** Bumped when the text is replaced (restore, keep), so the editor reloads it */
  const [revision, setRevision] = useState(0);
  const [toDelete, setToDelete] = useState<ChapterSummary | null>(null);
  const flushRef = useRef<(() => Promise<void>) | null>(null);

  const chapters = book.data?.chapters ?? [];
  const requestedId = searchParams.get("chapter");
  const selectedId = chapters.some((c) => c.id === requestedId)
    ? requestedId
    : (chapters[0]?.id ?? null);
  const chapter = useChapter(bookId, selectedId);
  const branches = useBranches(bookId, selectedId);
  const requestedBranch = searchParams.get("branch");
  const activeBranch = branches.data?.find((b) => b.id === requestedBranch) ?? null;
  const branch = useBranch(bookId, selectedId, activeBranch?.id ?? null);

  const selectChapter = useCallback(
    (chapterId: string) => {
      setSearchParams({ chapter: chapterId }, { replace: true });
      setSidebarOpen(false);
    },
    [setSearchParams],
  );

  const switchBranch = useCallback(
    (branchId: string | null) => {
      if (!selectedId) return;
      setSearchParams(
        branchId ? { chapter: selectedId, branch: branchId } : { chapter: selectedId },
        { replace: true },
      );
    },
    [selectedId, setSearchParams],
  );

  const toggleAside = (panel: "bible" | "history") =>
    setAside((open) => (open === panel ? null : panel));

  // Warn before closing the tab with unsaved text
  useEffect(() => {
    if (saveStatus === "saved") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveStatus]);

  const flushPending = useCallback(async () => {
    await flushRef.current?.();
  }, []);

  if (book.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6 text-violet-600" />
      </div>
    );
  }

  if (book.isError) {
    const notFound = book.error instanceof ApiRequestError && book.error.status === 404;
    return (
      <div className="min-h-screen bg-stone-50">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="text-xl font-semibold text-stone-900">
            {notFound ? "Book not found" : "Couldn't load this book"}
          </h1>
          {!notFound && <p className="mt-2 text-stone-600">{errorMessage(book.error)}</p>}
          <Link to="/books" className="mt-6 inline-block text-violet-600 hover:underline">
            Back to your books
          </Link>
        </main>
      </div>
    );
  }

  const handleDeleteChapter = () => {
    if (!toDelete) return;
    const index = chapters.findIndex((c) => c.id === toDelete.id);
    const neighbour = chapters[index + 1] ?? chapters[index - 1];
    deleteChapter.mutate(toDelete.id, {
      onSuccess: () => {
        if (toDelete.id === selectedId && neighbour) selectChapter(neighbour.id);
        setToDelete(null);
      },
    });
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      <AppHeader>
        <Link
          to="/books"
          className="rounded-md p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
          aria-label="Back to your books"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Show chapters"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 hover:bg-stone-100"
          title="Edit book details"
        >
          <span className="truncate font-medium text-stone-900">{book.data.title}</span>
          <Settings2 className="h-4 w-4 shrink-0 text-stone-400" />
        </button>
        <SaveStatusBadge status={saveStatus} />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={aside === "history" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={aside === "history"}
            aria-label="History"
            disabled={!selectedId}
            onClick={() => toggleAside("history")}
          >
            <History className="h-4 w-4 text-violet-600" />
            <span className="hidden lg:inline">History</span>
          </Button>
          <Button
            variant={aside === "bible" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={aside === "bible"}
            aria-label="Story Bible"
            onClick={() => toggleAside("bible")}
          >
            <BookMarked className="h-4 w-4 text-violet-600" />
            <span className="hidden lg:inline">Story Bible</span>
          </Button>
          <ExportButtons bookId={bookId} title={book.data.title} beforeExport={flushPending} />
          <Button
            variant={book.data.status === "published" ? "secondary" : "primary"}
            size="sm"
            aria-label={book.data.status === "published" ? "Published" : "Publish"}
            onClick={() => setPublishOpen(true)}
          >
            <Globe className="h-4 w-4" />
            <span className="hidden lg:inline">
              {book.data.status === "published" ? "Published" : "Publish"}
            </span>
          </Button>
        </div>
      </AppHeader>

      <div className="relative flex min-h-0 flex-1">
        <aside
          className={cn(
            "w-72 shrink-0 border-r border-stone-200 bg-stone-50",
            "absolute inset-y-0 left-0 z-20 shadow-lg transition-transform md:static md:translate-x-0 md:shadow-none",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <ChapterSidebar
            chapters={chapters}
            selectedId={selectedId}
            onSelect={selectChapter}
            onAdd={() => createChapter.mutate(undefined, { onSuccess: (c) => selectChapter(c.id) })}
            adding={createChapter.isPending}
            onDelete={setToDelete}
            onReorder={(ids) => reorderChapters.mutate(ids)}
            onPlan={() => setPlanOpen(true)}
          />
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {(chapter.isPending && selectedId) || (activeBranch && branch.isPending) ? (
            <div className="flex justify-center py-20">
              <Spinner className="h-6 w-6 text-violet-600" />
            </div>
          ) : chapter.isError ? (
            <p role="alert" className="m-8 rounded-lg bg-red-50 px-4 py-3 text-red-700">
              Couldn't load this chapter. {errorMessage(chapter.error)}
            </p>
          ) : branch.isError ? (
            <p role="alert" className="m-8 rounded-lg bg-red-50 px-4 py-3 text-red-700">
              Couldn't load this what-if branch. {errorMessage(branch.error)}
            </p>
          ) : chapter.data ? (
            <>
              <BranchBar
                bookId={bookId}
                chapterId={chapter.data.id}
                branches={branches.data ?? []}
                activeBranch={activeBranch}
                onSwitch={(branchId) => {
                  void flushPending().then(() => switchBranch(branchId));
                }}
                flushPending={flushPending}
                onKept={() => setRevision((r) => r + 1)}
              />
              <ChapterEditor
                key={`${chapter.data.id}:${activeBranch?.id ?? "main"}:${revision}`}
                bookId={bookId}
                chapter={chapter.data}
                branch={activeBranch ? (branch.data ?? null) : null}
                onStatusChange={setSaveStatus}
                flushRef={flushRef}
              />
            </>
          ) : (
            <p className="p-8 text-stone-600">Add a chapter to start writing.</p>
          )}
        </main>

        {aside && (
          <aside className="absolute inset-y-0 right-0 z-20 w-80 border-l border-stone-200 bg-stone-50 shadow-lg xl:static xl:shadow-none">
            {aside === "bible" ? (
              <StoryBiblePanel
                bookId={bookId}
                onOpenChapter={selectChapter}
                onClose={() => setAside(null)}
              />
            ) : selectedId ? (
              <HistoryPanel
                key={`${selectedId}:${activeBranch?.id ?? "main"}`}
                bookId={bookId}
                chapterId={selectedId}
                branch={activeBranch}
                currentContent={(activeBranch ? branch.data?.content : chapter.data?.content) ?? ""}
                flushPending={flushPending}
                onRestored={() => setRevision((r) => r + 1)}
                onOpenBranch={switchBranch}
                onClose={() => setAside(null)}
              />
            ) : null}
          </aside>
        )}
      </div>

      <OutlineDialog
        book={book.data}
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        onAdded={selectChapter}
      />

      <PublishDialog
        book={book.data}
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        flushPending={flushPending}
      />

      <BookDetailsDialog
        book={book.data}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete chapter?"
        confirmLabel="Delete chapter"
        loading={deleteChapter.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={handleDeleteChapter}
      >
        <strong>{toDelete?.title || "This chapter"}</strong> will be permanently deleted. This can't
        be undone.
      </ConfirmDialog>
    </div>
  );
}
