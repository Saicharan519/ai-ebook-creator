import { BookOpenText, Brain, FileDown, PenLine, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../features/auth/auth-context";
import { ApiStatus } from "../features/health/ApiStatus";

const FEATURES = [
  {
    icon: PenLine,
    title: "A calm place to write",
    body: "Chapters you can drag into order, a clean editor, and autosave that never loses a sentence.",
  },
  {
    icon: FileDown,
    title: "Export when you're ready",
    body: "Download a typeset PDF or a Word document with your cover, title page, and chapters.",
  },
  {
    icon: Sparkles,
    title: "An AI co-writer",
    body: "Select a paragraph and ask it to continue, rewrite, or expand, in your book's style.",
    soon: true,
  },
  {
    icon: Brain,
    title: "Story Memory",
    body: "Keeps track of characters, places, and events so chapter 30 agrees with chapter 3.",
    soon: true,
  },
];

export function LandingPage() {
  const { state } = useAuth();
  const signedIn = state.status === "authenticated";

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 font-semibold text-stone-900">
          <BookOpenText className="h-5 w-5 text-violet-600" />
          AI eBook Creator
        </span>
        <nav className="flex items-center gap-4 text-sm">
          {signedIn ? (
            <Link to="/books" className="font-medium text-violet-700 hover:underline">
              Your books
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-stone-700 hover:text-stone-900">
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-violet-600 px-3 py-1.5 font-medium text-white hover:bg-violet-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-6 pt-16 pb-20 text-center sm:pt-24">
          <h1 className="font-serif text-4xl leading-tight font-semibold text-stone-900 sm:text-6xl">
            Write long stories with an AI that remembers them.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-stone-600">
            Novels, story collections, and notes, written chapter by chapter, and exported as a
            finished book.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link
              to={signedIn ? "/books" : "/signup"}
              className="rounded-lg bg-violet-600 px-5 py-3 font-medium text-white hover:bg-violet-700"
            >
              {signedIn ? "Open your books" : "Start writing for free"}
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body, soon }) => (
            <div key={title} className="rounded-xl border border-stone-200 bg-white p-5">
              <Icon className="h-6 w-6 text-violet-600" />
              <h2 className="mt-3 flex items-center gap-2 font-semibold text-stone-900">
                {title}
                {soon && (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                    Coming soon
                  </span>
                )}
              </h2>
              <p className="mt-2 text-sm text-stone-600">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-stone-200 py-6 text-center">
        <ApiStatus />
      </footer>
    </div>
  );
}
