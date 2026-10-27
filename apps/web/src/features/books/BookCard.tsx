import type { BookSummary } from "@ebook/shared";
import { Trash2 } from "lucide-react";
import { Link } from "react-router";
import { pluralize, timeAgo } from "../../lib/format";
import { BookCover } from "./BookCover";

/** A book on the shelf: the cover lifts on hover, details sit underneath. */
export function BookCard({
  book,
  onDelete,
}: {
  book: BookSummary;
  onDelete: (book: BookSummary) => void;
}) {
  return (
    <article className="group relative">
      <Link to={`/books/${book.id}`} className="block rounded-md focus-visible:outline-offset-4">
        <div className="shadow-book transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-book-lift">
          <BookCover book={book} author={book.author} />
        </div>
        <div className="mt-3.5 min-w-0 pr-6">
          <h3 className="truncate font-serif text-[1.05rem] leading-snug font-medium text-stone-900">
            {book.title}
          </h3>
          <p className="tabular mt-0.5 truncate text-xs text-stone-500">
            {pluralize(book.wordCount, "word")} · {pluralize(book.chapterCount, "chapter")}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-xs text-stone-400">
            {book.status === "published" && (
              <span className="rounded-[3px] bg-accent-50 px-1.5 py-px text-[0.65rem] font-semibold tracking-wide text-accent-700 uppercase ring-1 ring-accent-200/70">
                Published
              </span>
            )}
            <span className="truncate">Edited {timeAgo(book.updatedAt)}</span>
          </p>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onDelete(book)}
        className="absolute top-2 right-2 rounded-md bg-paper/90 p-1.5 text-stone-500 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 hover:text-accent-700 focus:opacity-100"
        aria-label={`Delete ${book.title}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </article>
  );
}
