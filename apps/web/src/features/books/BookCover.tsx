import { cn } from "../../lib/cn";

// A stable gradient per book, so covers without an image still look distinct
const GRADIENTS = [
  "from-violet-500 to-indigo-700",
  "from-amber-400 to-rose-600",
  "from-emerald-400 to-teal-700",
  "from-sky-400 to-blue-700",
  "from-fuchsia-500 to-purple-800",
  "from-orange-400 to-red-700",
];

function gradientFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

export function BookCover({
  book,
  className,
}: {
  book: { id: string; title: string; coverUrl: string | null };
  className?: string;
}) {
  if (book.coverUrl) {
    return (
      <img
        src={book.coverUrl}
        alt={`Cover of ${book.title}`}
        className={cn("aspect-[2/3] w-full rounded-md object-cover", className)}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex aspect-[2/3] w-full items-end rounded-md bg-gradient-to-br p-3",
        gradientFor(book.id),
        className,
      )}
    >
      <span className="line-clamp-4 font-serif text-lg leading-tight font-semibold text-white drop-shadow">
        {book.title}
      </span>
    </div>
  );
}
