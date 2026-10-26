import type { BookSummary } from "@ebook/shared";
import { BookPlus, Plus } from "lucide-react";
import { useState } from "react";
import { AppHeader } from "../components/layout/AppHeader";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Spinner } from "../components/ui/Spinner";
import { BookCard } from "../features/books/BookCard";
import { useBooks, useDeleteBook } from "../features/books/books-api";
import { CreateBookDialog } from "../features/books/CreateBookDialog";
import { errorMessage } from "../lib/form-errors";

export function DashboardPage() {
  const books = useBooks();
  const deleteBook = useDeleteBook();
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<BookSummary | null>(null);

  return (
    <div className="min-h-screen bg-stone-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-stone-900">Your books</h1>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New book
          </Button>
        </div>

        {books.isPending ? (
          <div className="flex justify-center py-20">
            <Spinner className="h-6 w-6 text-violet-600" />
          </div>
        ) : books.isError ? (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-700">
            Couldn't load your books. {errorMessage(books.error)}
          </p>
        ) : books.data.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
            <BookPlus className="h-10 w-10 text-violet-500" />
            <h2 className="mt-4 text-lg font-semibold text-stone-900">Start your first book</h2>
            <p className="mt-1 max-w-sm text-sm text-stone-600">
              A novel, a short-story collection, or notes you want to turn into something readable.
            </p>
            <Button className="mt-6" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New book
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {books.data.map((book) => (
              <BookCard key={book.id} book={book} onDelete={setToDelete} />
            ))}
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
