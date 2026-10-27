import type { BookSummary } from "@ebook/shared";
import { Plus } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useCurrentUser } from "../features/auth/auth-context";
import { BookCard } from "../features/books/BookCard";
import { useBooks, useDeleteBook } from "../features/books/books-api";
import { CreateBookDialog } from "../features/books/CreateBookDialog";
import { errorMessage } from "../lib/form-errors";
import { pluralize } from "../lib/format";

const SHELF_GRID =
  "grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4 xl:grid-cols-5";

export function DashboardPage() {
  const user = useCurrentUser();
  const books = useBooks();
  const deleteBook = useDeleteBook();
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<BookSummary | null>(null);

  const totalWords = books.data?.reduce((sum, book) => sum + book.wordCount, 0) ?? 0;
  const firstName = user.name.trim().split(/\s+/)[0];

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-5 pt-12 pb-24 sm:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-stone-900/[0.08] pb-6">
          <div>
            <p className="text-sm text-stone-500">
              {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
            </p>
            <h1 className="mt-1 font-serif text-4xl font-medium tracking-[-0.02em] text-stone-900">
              Your books
            </h1>
            {books.data && books.data.length > 0 && (
              <p className="tabular mt-2 text-sm text-stone-500">
                {pluralize(books.data.length, "book")} · {pluralize(totalWords, "word")} written
              </p>
            )}
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New book
          </Button>
        </div>

        {books.isPending ? (
          <ShelfSkeleton />
        ) : books.isError ? (
          <p role="alert" className="rounded-md bg-accent-50 px-4 py-3 text-accent-800">
            Couldn't load your books. {errorMessage(books.error)}
          </p>
        ) : books.data.length === 0 ? (
          <EmptyShelf onCreate={() => setCreating(true)} />
        ) : (
          <div className={SHELF_GRID}>
            {books.data.map((book, i) => (
              <div key={book.id} className="rise-in" style={{ "--i": i } as CSSProperties}>
                <BookCard book={book} onDelete={setToDelete} />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="group flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-[2px_5px_5px_2px] border border-dashed border-stone-300 text-stone-500 transition-colors duration-200 hover:border-accent-400 hover:bg-white/50 hover:text-accent-700"
            >
              <Plus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
              <span className="text-sm font-medium">Start a new book</span>
            </button>
          </div>
        )}
      </main>

      <CreateBookDialog open={creating} onClose={() => setCreating(false)} />

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete book?"
        confirmLabel="Delete book"
        loading={deleteBook.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          toDelete && deleteBook.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
        }
      >
        <strong>{toDelete?.title}</strong> and all of its chapters will be permanently deleted. This
        can't be undone.
      </ConfirmDialog>
    </div>
  );
}

function EmptyShelf({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="grid items-center gap-10 py-6 md:grid-cols-[1fr_1.1fr]">
      <div
        className="mx-auto flex w-full max-w-xs items-end justify-center gap-3"
        aria-hidden="true"
      >
        {["bg-[#6b2a22] h-44", "bg-[#24402f] h-52", "bg-[#1f2c44] h-40"].map((style) => (
          <span
            key={style}
            className={`${style} w-14 rounded-[2px_4px_4px_2px] shadow-book ring-1 ring-black/10 ring-inset`}
          />
        ))}
      </div>
      <div className="max-w-md">
        <h2 className="font-serif text-3xl font-medium tracking-[-0.015em] text-stone-900">
          An empty shelf, for now.
        </h2>
        <p className="mt-3 text-stone-600">
          Start a novel, a collection of short stories, or notes you want to turn into something
          readable. You can plan the chapters with AI once the book exists.
        </p>
        <Button className="mt-6" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          New book
        </Button>
      </div>
    </section>
  );
}

function ShelfSkeleton() {
  return (
    <div className={SHELF_GRID} role="status" aria-label="Loading your books">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[2/3] rounded-[2px_5px_5px_2px] bg-stone-900/[0.07]" />
          <div className="mt-3.5 h-4 w-3/4 rounded bg-stone-900/[0.07]" />
          <div className="mt-2 h-3 w-1/2 rounded bg-stone-900/[0.05]" />
        </div>
      ))}
    </div>
  );
}
