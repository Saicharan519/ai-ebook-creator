import type { BookSummary } from "@ebook/shared";
import { Trash2 } from "lucide-react";
import { Link } from "react-router";
import { pluralize, timeAgo } from "../../lib/format";
import { BookCover } from "./BookCover";

export function BookCard({
  book,
  onDelete,
}: {
  book: BookSummary;
  onDelete: (book: BookSummary) => void;
}) {
  return (
    <article className="group relative flex flex-col rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition hover:shadow-md">
      <Link to={`/books/${book.id}`} className="flex flex-1 flex-col gap-3">
        <BookCover book={book} />
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-stone-900">{book.title}</h3>
          {book.genre && <p className="truncate text-sm text-stone-500">{book.genre}</p>}
          <p className="mt-1 text-xs text-stone-500">
            {pluralize(book.chapterCount, "chapter")} · {pluralize(book.wordCount, "word")}
          </p>
          <p className="text-xs text-stone-400">Edited {timeAgo(book.updatedAt)}</p>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onDelete(book)}
        className="absolute top-5 right-5 rounded-md bg-white/90 p-1.5 text-stone-500 opacity-0 shadow-sm transition group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
        aria-label={`Delete ${book.title}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </article>
  );
}
