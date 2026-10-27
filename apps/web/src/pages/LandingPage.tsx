import { ArrowDown, ArrowRight, Check, FileText, Globe, History } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "../components/layout/Logo";
import { useAuth } from "../features/auth/auth-context";
import { ApiStatus } from "../features/health/ApiStatus";
import { cn } from "../lib/cn";

const REPO_URL = "https://github.com/Saicharan519/ai-ebook-creator";

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

export function LandingPage() {
  const { state } = useAuth();
  const signedIn = state.status === "authenticated";
  const startHref = signedIn ? "/books" : "/signup";
  const startLabel = signedIn ? "Open your books" : "Start writing, free";

  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          {signedIn ? (
            <InkLink to="/books">Your books</InkLink>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-md px-3 py-2 text-stone-700 transition-colors hover:text-stone-900"
              >
                Log in
              </Link>
              <InkLink to="/signup">Sign up</InkLink>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-10 pb-24 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <p className="rise-in flex items-center gap-3 text-sm font-medium text-accent-700">
              <span className="h-px w-8 bg-accent-500" aria-hidden="true" />A writing studio for
              long fiction
            </p>
            <h1
              className="rise-in mt-6 font-serif text-[2.75rem] leading-[1.02] font-medium tracking-[-0.03em] text-stone-900 sm:text-6xl lg:text-[4.25rem]"
              style={stagger(1)}
            >
              Write long stories with an AI that <em className="text-accent-700">remembers</em>{" "}
              them.
            </h1>
            <p
              className="rise-in mt-6 max-w-[34rem] text-lg leading-relaxed text-stone-600"
              style={stagger(2)}
            >
              Plan your chapters, draft alongside a co-writer, and let Story Memory keep every
              character, place, and promise straight, from the first chapter to the fortieth.
            </p>
            <div
              className="rise-in mt-9 flex flex-wrap items-center gap-x-6 gap-y-3"
              style={stagger(3)}
            >
              <InkLink to={startHref} large>
                {startLabel}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </InkLink>
              <a
                href="#memory"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 transition-colors hover:text-stone-900 hover:decoration-stone-500"
              >
                How Story Memory works
                <ArrowDown className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="rise-in mt-10 max-w-md text-sm text-stone-500" style={stagger(4)}>
              On a test novel with seven planted mistakes, Story Memory flagged{" "}
              <span className="tabular font-semibold text-stone-800">76%</span> of them across three
              runs, with <span className="font-semibold text-stone-800">no false alarms</span>.
            </p>
          </div>

          <ManuscriptPreview />
        </section>

        {/* Features */}
        <section
          id="memory"
          className="scroll-mt-8 border-t border-stone-900/[0.07] bg-paper-deep/50"
        >
          <div className="mx-auto max-w-6xl space-y-24 px-5 py-24 sm:px-8 lg:space-y-32">
            <Feature
              kicker="Story Memory"
              title="It reads every chapter, so you don't have to reread them."
              body="After each save, the book is read in the background: who appears, where they are, what they're wearing, what was promised. The AI uses that when it writes, and you get a quiet note when chapter 12 disagrees with chapter 3."
              points={[
                "A Story Bible of characters, places, and facts you can edit and pin",
                "Contradictions flagged with links to both chapters",
                "Dismiss a flag once and it stays dismissed",
              ]}
              visual={<StoryBibleVisual />}
            />
            <Feature
              flip
              kicker="Co-writer"
              title="Ask for a paragraph, not a whole book."
              body="Select a passage and continue it, rewrite it, expand it, or shift its tone. The suggestion streams in beside your text; nothing changes until you accept it."
              points={[
                "Plans chapters from your premise",
                "Drafts a chapter in your book's style",
                "Stop, retry, or discard at any time",
              ]}
              visual={<CoWriterVisual />}
            />
            <Feature
              kicker="History and what-ifs"
              title="Try the darker ending without losing the first one."
              body="Every chapter keeps its own history: versions you save, a copy before each AI change, and an autosave every ten minutes. Branch a chapter to try another direction, then keep whichever you like."
              points={[
                "Word-by-word comparison with any earlier version",
                "Restoring is itself undoable",
                "What-if branches stay out of Story Memory until you keep them",
              ]}
              visual={<HistoryVisual />}
            />
            <Feature
              flip
              kicker="Finish"
              title="From draft to a book people can read."
              body="Export a typeset PDF, a Word document, or an EPUB, each with your cover and a table of contents. Or publish to a clean reading page and share the link."
              points={[
                "PDF contents with page numbers and links",
                "EPUB 3 that works on e-readers",
                "Unpublish any time; the link stays the same",
              ]}
              visual={<FinishVisual />}
            />
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-8 border-y border-stone-900/10 py-14 md:flex-row md:items-center">
            <h2 className="max-w-xl font-serif text-4xl leading-tight font-medium tracking-[-0.02em] text-stone-900 sm:text-5xl">
              Your next chapter is <em className="text-accent-700">waiting</em>.
            </h2>
            <InkLink to={startHref} large>
              {startLabel}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </InkLink>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 pb-10 text-sm text-stone-500 sm:px-8">
        <Logo className="opacity-80" />
        <div className="flex items-center gap-6">
          <ApiStatus />
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-stone-300 underline-offset-4 hover:text-stone-800"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

function InkLink({ to, children, large }: { to: string; children: ReactNode; large?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex items-center gap-2 rounded-md bg-stone-900 font-medium text-paper shadow-sm",
        "transition-[background-color,transform] duration-200 hover:bg-stone-800 active:translate-y-px",
        large ? "h-12 px-6 text-[0.95rem]" : "h-9 px-4 text-sm",
      )}
    >
      {children}
    </Link>
  );
}

function Feature({
  kicker,
  title,
  body,
  points,
  visual,
  flip = false,
}: {
  kicker: string;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <article className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
      <div className={cn(flip && "lg:order-2")}>
        <p className="text-sm font-medium text-accent-700">{kicker}</p>
        <h2 className="mt-3 font-serif text-3xl leading-[1.12] font-medium tracking-[-0.02em] text-stone-900 sm:text-[2.5rem]">
          {title}
        </h2>
        <p className="mt-5 max-w-[34rem] leading-relaxed text-stone-600">{body}</p>
        <ul className="mt-6 space-y-2.5">
          {points.map((point) => (
            <li key={point} className="flex gap-3 text-sm text-stone-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(flip && "lg:order-1")} aria-hidden="true">
        {visual}
      </div>
    </article>
  );
}

// ---- Illustrations: static, simplified copies of the real UI ----

function Page({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-md bg-white shadow-page ring-1 ring-stone-900/[0.06]", className)}>
      {children}
    </div>
  );
}

function ManuscriptPreview() {
  return (
    <div
      className="rise-in relative mx-auto w-full max-w-lg lg:mr-0"
      style={stagger(2)}
      aria-hidden="true"
    >
      <Page className="relative rotate-[0.6deg] px-8 pt-9 pb-12 sm:px-11">
        <p className="text-xs font-medium tracking-[0.16em] text-stone-400 uppercase">Chapter 7</p>
        <p className="mt-2 font-serif text-2xl font-medium text-stone-900">The Lighthouse</p>
        <div className="mt-6 space-y-4 font-serif text-[1.05rem] leading-[1.75] text-stone-700">
          <p>
            The lamp had not been lit in eleven years. Elspeth climbed the last of the iron stairs
            and looked out over the black water, her{" "}
            <span className="bg-accent-50 decoration-accent-500 decoration-wavy decoration-1 underline underline-offset-4">
              brown eyes
            </span>{" "}
            narrowed against the wind.
          </p>
          <p className="text-stone-400">
            Somewhere below, the boat her father had built was still rocking at its mooring
            <span className="ml-0.5 inline-block h-[1.1em] w-px translate-y-[3px] animate-pulse bg-stone-800" />
          </p>
        </div>
        <span className="tabular absolute top-9 right-8 flex items-center gap-1.5 text-xs text-stone-400 sm:right-11">
          <Check className="h-3 w-3" /> Saved · 2,418 words
        </span>
      </Page>

      <div className="relative -mt-14 ml-auto w-[78%] -rotate-[1.2deg] sm:-mr-8">
        <div className="rounded-md border border-accent-200/80 bg-[#fdf8f5] p-4 shadow-book">
          <p className="flex items-center gap-2 text-xs font-semibold text-accent-700">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
            Story Memory
          </p>
          <p className="mt-2 text-sm leading-snug text-stone-800">
            <span className="font-medium">Elspeth: eye colour.</span> Chapter 1 says “grey”; this
            chapter says “brown”.
          </p>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="rounded border border-stone-300 bg-white px-2 py-1 text-stone-700">
              Open ch. 1
            </span>
            <span className="rounded px-2 py-1 text-stone-500">It's intended</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryBibleVisual() {
  const entries = [
    { name: "Elspeth Gunn", kind: "Character", facts: ["eye colour: grey", "age: 19"] },
    { name: "Eilean Dubh", kind: "Place", facts: ["lighthouse on the north cliff"] },
    { name: "The Kittiwake", kind: "Item", facts: ["her father's boat"] },
  ];
  return (
    <Page className="mx-auto max-w-md p-5">
      <p className="font-serif text-lg font-medium text-stone-900">Story Bible</p>
      <ul className="mt-4 divide-y divide-stone-100">
        {entries.map((entry) => (
          <li key={entry.name} className="py-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-stone-900">{entry.name}</span>
              <span className="text-xs text-stone-400">{entry.kind}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {entry.facts.map((fact) => (
                <span key={fact} className="rounded bg-paper px-2 py-0.5 text-xs text-stone-600">
                  {fact}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Page>
  );
}

function CoWriterVisual() {
  return (
    <div className="relative mx-auto max-w-md">
      <Page className="p-6 font-serif text-[1.02rem] leading-[1.7] text-stone-700">
        <p>
          The ferry was late.{" "}
          <span className="bg-accent-100/70">
            Mara waited by the rail and thought about the letter.
          </span>
        </p>
        <div className="mt-4 rounded-md border-l-2 border-accent-500 bg-paper px-4 py-3 font-sans text-sm leading-relaxed text-stone-700">
          <p className="mb-1 text-xs font-semibold text-accent-700">Show, don't tell</p>
          <p className="font-serif text-[0.98rem]">
            Mara's thumb worried the folded corner of the letter until the paper went soft…
          </p>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="rounded bg-stone-900 px-2 py-1 text-paper">Replace selection</span>
            <span className="rounded px-2 py-1 text-stone-500">Discard</span>
          </div>
        </div>
      </Page>
      <div className="absolute -top-5 right-4 flex gap-1 rounded-md bg-stone-900 p-1 text-xs text-paper shadow-book">
        {["Rewrite", "Expand", "Shorten", "Tone"].map((action, i) => (
          <span key={action} className={cn("rounded px-2 py-1", i === 0 && "bg-white/15")}>
            {action}
          </span>
        ))}
      </div>
    </div>
  );
}

function HistoryVisual() {
  const versions = [
    { label: "Before an AI change", when: "just now" },
    { label: "First full draft", when: "2 hours ago", active: true },
    { label: "Autosave", when: "yesterday" },
  ];
  return (
    <div className="mx-auto grid max-w-md gap-3">
      <Page className="p-2">
        {versions.map((version) => (
          <div
            key={version.label}
            className={cn(
              "flex items-center justify-between rounded px-3 py-2.5 text-sm",
              version.active && "bg-accent-50",
            )}
          >
            <span className="flex items-center gap-2 text-stone-800">
              <History className="h-3.5 w-3.5 text-stone-400" />
              {version.label}
            </span>
            <span className="text-xs text-stone-400">{version.when}</span>
          </div>
        ))}
      </Page>
      <Page className="p-4 font-serif text-[0.98rem] leading-relaxed text-stone-700">
        She opened the door{" "}
        <del className="bg-accent-100 text-accent-800">and stepped into the light</del>{" "}
        <ins className="bg-emerald-100 text-emerald-900 no-underline">and did not step through</ins>
        .
      </Page>
    </div>
  );
}

function FinishVisual() {
  return (
    <div className="mx-auto flex max-w-md items-end gap-4">
      <div className="w-32 shrink-0 rounded-[2px_5px_5px_2px] bg-[#24402f] p-4 pt-6 shadow-book-lift">
        <span className="block h-px bg-[#e9dcc0]/50" />
        <span className="mt-0.5 block h-px bg-[#e9dcc0]/50" />
        <p className="mt-6 font-serif text-lg leading-tight text-[#f3ead8]">The Salt Road</p>
        <p className="mt-14 text-[0.55rem] tracking-[0.18em] text-[#e9dcc0]/70 uppercase">
          Edith Moore
        </p>
      </div>
      <div className="flex-1 space-y-2.5">
        {["pdf", "docx", "epub"].map((extension) => (
          <Page key={extension} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <FileText className="h-4 w-4 text-stone-400" />
            <span className="text-stone-800">The Salt Road.{extension}</span>
          </Page>
        ))}
        <Page className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <Globe className="h-4 w-4 text-accent-600" />
          <span className="truncate text-stone-800">/read/the-salt-road</span>
        </Page>
      </div>
    </div>
  );
}
