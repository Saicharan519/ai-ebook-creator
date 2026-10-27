import type { PublicBook } from "@ebook/shared";
import { ArrowLeft, ArrowRight, BookOpen, List } from "lucide-react";
import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { Spinner } from "../components/ui/Spinner";
import { BookCover } from "../features/books/BookCover";
import { MarkdownView } from "../features/reader/MarkdownView";
import { usePublicBook, usePublicChapter } from "../features/reader/reader-api";
import { ApiRequestError } from "../lib/api";
import { errorMessage } from "../lib/form-errors";
import { pluralize } from "../lib/format";

/** Public, read-only page for a published book. No login needed. */
export function ReaderPage() {
  const { slug = "", chapterId } = useParams();
  const book = usePublicBook(slug);

  useEffect(() => {
    if (book.data) document.title = `${book.data.title} by ${book.data.author}`;
    return () => {
      document.title = "AI eBook Creator";
    };
  }, [book.data]);

  if (book.isPending) return <CenteredSpinner />;
  if (book.isError) return <ReaderError error={book.error} />;

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 border-b border-stone-900/[0.07] bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link
            to={`/read/${slug}`}
            className="flex min-w-0 items-center gap-2 font-serif font-semibold text-stone-900"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-accent-600" />
            <span className="truncate">{book.data.title}</span>
          </Link>
          <span className="hidden truncate text-sm text-stone-500 sm:inline">
            by {book.data.author}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {chapterId ? (
          <ChapterView
            key={chapterId}
            slug={slug}
            chapterId={chapterId}
            bookTitle={book.data.title}
          />
        ) : (
          <BookHome book={book.data} />
        )}
      </main>

      <footer className="pb-10 text-center text-xs text-stone-400">
        Written with{" "}
        <Link to="/" className="hover:text-accent-600 hover:underline">
          AI eBook Creator
        </Link>
      </footer>
    </div>
  );
}

function BookHome({ book }: { book: PublicBook }) {
  const first = book.chapters[0];
  const published = new Date(book.publishedAt).toLocaleDateString(undefined, {
    dateStyle: "long",
  });

  return (
    <>
      <section className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {/* BookCover fills its container's width */}
        <div className="w-44 shrink-0 shadow-book-lift">
          <BookCover
            book={{ id: book.slug, title: book.title, coverUrl: book.coverUrl }}
            author={book.author}
          />
        </div>
        <div>
          {book.genre && (
            <p className="text-xs font-medium tracking-wide text-accent-700 uppercase">
              {book.genre}
            </p>
          )}
          <h1 className="mt-1 font-serif text-5xl leading-[1.05] font-medium tracking-[-0.02em] text-stone-900">
            {book.title}
          </h1>
          {book.subtitle && <p className="mt-1 text-lg text-stone-600">{book.subtitle}</p>}
          <p className="mt-3 text-stone-700">by {book.author}</p>
          <p className="mt-1 text-sm text-stone-500">
            {pluralize(book.chapters.length, "chapter")} · {pluralize(book.wordCount, "word")} ·
            Published {published}
          </p>
          {first && (
            <Link
              to={`/read/${book.slug}/${first.id}`}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-stone-900 px-5 text-sm font-medium text-paper transition-colors hover:bg-stone-800"
            >
              Start reading
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </section>

      <nav aria-labelledby="contents-heading" className="mt-12">
        <h2 id="contents-heading" className="font-serif text-2xl font-medium text-stone-900">
          Contents
        </h2>
        <ol className="mt-4 divide-y divide-stone-900/[0.07] border-y border-stone-900/[0.07]">
          {book.chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <Link
                to={`/read/${book.slug}/${chapter.id}`}
                className="flex items-baseline gap-4 px-2 py-3.5 transition-colors hover:bg-white/60"
              >
                <span className="w-6 shrink-0 text-right text-sm text-stone-400">{index + 1}</span>
                <span className="flex-1 font-serif text-stone-900">{chapter.title}</span>
                <span className="text-xs text-stone-400">
                  {pluralize(chapter.wordCount, "word")}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

function ChapterView({
  slug,
  chapterId,
  bookTitle,
}: {
  slug: string;
  chapterId: string;
  bookTitle: string;
}) {
  const chapter = usePublicChapter(slug, chapterId);

  useEffect(() => {
    if (chapter.data) document.title = `${chapter.data.title} · ${bookTitle}`;
    window.scrollTo({ top: 0 });
  }, [chapter.data, bookTitle]);

  if (chapter.isPending) return <CenteredSpinner />;
  if (chapter.isError) {
    return (
      <div className="py-10 text-center">
        <p className="text-stone-700">
          {isNotFound(chapter.error)
            ? "This chapter isn't available."
            : `Couldn't load this chapter. ${errorMessage(chapter.error)}`}
        </p>
        <Link to={`/read/${slug}`} className="mt-4 inline-block text-accent-600 hover:underline">
          Back to contents
        </Link>
      </div>
    );
  }

  const { previous, next } = chapter.data;

  return (
    <article>
      <p className="text-sm font-medium text-accent-700">Chapter {chapter.data.number}</p>
      <h1 className="mt-2 mb-10 font-serif text-4xl leading-tight font-medium tracking-[-0.02em] text-stone-900">
        {chapter.data.title}
      </h1>
      <MarkdownView markdown={chapter.data.content} />

      <nav
        aria-label="Chapters"
        className="mt-14 flex items-stretch justify-between gap-3 border-t border-stone-200 pt-6"
      >
        {previous ? <ChapterLink slug={slug} chapter={previous} direction="previous" /> : <span />}
        <Link
          to={`/read/${slug}`}
          className="flex items-center gap-1.5 self-center rounded-md px-3 py-2 text-sm text-stone-600 hover:bg-stone-100"
        >
          <List className="h-4 w-4" />
          Contents
        </Link>
        {next ? <ChapterLink slug={slug} chapter={next} direction="next" /> : <span />}
      </nav>
    </article>
  );
}

function ChapterLink({
  slug,
  chapter,
  direction,
}: {
  slug: string;
  chapter: { id: string; title: string };
  direction: "previous" | "next";
}) {
  const isNext = direction === "next";
  return (
    <Link
      to={`/read/${slug}/${chapter.id}`}
      rel={isNext ? "next" : "prev"}
      className={`flex max-w-[40%] items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 hover:border-accent-300 ${
        isNext ? "text-right" : ""
      }`}
    >
      {!isNext && <ArrowLeft className="h-4 w-4 shrink-0 text-stone-400" />}
      <span className="min-w-0">
        <span className="block text-xs text-stone-500">{isNext ? "Next" : "Previous"}</span>
        <span className="block truncate font-serif text-stone-900">{chapter.title}</span>
      </span>
      {isNext && <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />}
    </Link>
  );
}

const isNotFound = (error: Error) => error instanceof ApiRequestError && error.status === 404;

function ReaderError({ error }: { error: Error }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-4 text-center">
      <h1 className="font-serif text-2xl font-semibold text-stone-900">
        {isNotFound(error) ? "This book isn't available" : "Couldn't load this book"}
      </h1>
      <p className="max-w-sm text-stone-600">
        {isNotFound(error)
          ? "The link may be wrong, or the author has unpublished it."
          : errorMessage(error)}
      </p>
      <Link to="/" className="text-accent-600 hover:underline">
        Go to AI eBook Creator
      </Link>
    </main>
  );
}

function CenteredSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="h-6 w-6 text-accent-600" />
    </div>
  );
}
