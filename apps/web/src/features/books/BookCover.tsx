import { cn } from "../../lib/cn";

// Muted bookcloth colours; each book keeps the same one
const CLOTHS = [
  "bg-[#6b2a22]", // oxblood
  "bg-[#24402f]", // forest
  "bg-[#1f2c44]", // navy
  "bg-[#76531f]", // ochre
  "bg-[#3d3a45]", // slate
  "bg-[#4e2a3b]", // plum
  "bg-[#2f4a4a]", // teal
];

function clothFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CLOTHS[hash % CLOTHS.length];
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** The spine shading and cloth grain that make a flat rectangle read as a book */
function BookSurface() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[9%] bg-gradient-to-r from-black/35 via-white/10 to-black/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-black/10 ring-inset"
      />
    </>
  );
}

export function BookCover({
  book,
  author,
  className,
}: {
  book: { id: string; title: string; coverUrl: string | null };
  author?: string;
  className?: string;
}) {
  const shape = "relative aspect-[2/3] w-full overflow-hidden rounded-[2px_5px_5px_2px]";

  if (book.coverUrl) {
    return (
      <div className={cn(shape, "bg-stone-200", className)}>
        <img
          src={book.coverUrl}
          alt={`Cover of ${book.title}`}
          className="h-full w-full object-cover"
        />
        <BookSurface />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        shape,
        "flex flex-col px-[12%] pt-[16%] pb-[10%]",
        clothFor(book.id),
        className,
      )}
    >
      <BookSurface />
      <span className="h-px w-full bg-[#e9dcc0]/45" />
      <span className="mt-[3px] h-px w-full bg-[#e9dcc0]/45" />
      <span className="mt-[14%] line-clamp-5 font-serif text-[clamp(0.95rem,1.6vw,1.35rem)] leading-[1.12] font-medium tracking-[-0.01em] text-[#f3ead8]">
        {book.title}
      </span>
      {author && (
        <span className="mt-auto truncate text-[0.6rem] font-medium tracking-[0.18em] text-[#e9dcc0]/75 uppercase">
          {author}
        </span>
      )}
    </div>
  );
}
