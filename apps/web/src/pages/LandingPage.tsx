import { ArrowDown, ArrowRight, BookMarked, Check, FileText, Globe, History } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "../components/layout/Logo";
import { Reveal } from "../components/ui/Reveal";
import { useAuth } from "../features/auth/auth-context";
import { ApiStatus } from "../features/health/ApiStatus";
import { cn } from "../lib/cn";
import { prefersReducedMotion, useCountUp, useInView, useTypewriter } from "../lib/motion";

const REPO_URL = "https://github.com/Saicharan519/ai-ebook-creator";

const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

const GENRES = [
  "Literary fiction",
  "Fantasy",
  "Mystery",
  "Short stories",
  "Science fiction",
  "Romance",
  "Memoir",
  "Thrillers",
  "Novellas",
  "Field notes",
];

export function LandingPage() {
  const { state } = useAuth();
  const signedIn = state.status === "authenticated";
  const startHref = signedIn ? "/books" : "/signup";
  const startLabel = signedIn ? "Open your books" : "Start writing, free";

  return (
    <div className="min-h-dvh overflow-x-clip">
      <div className="hero-atmosphere">
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

        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-16 px-5 pt-10 pb-28 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <p className="rise-in flex items-center gap-3 text-sm font-medium text-accent-700">
              <span className="h-px w-8 bg-accent-500" aria-hidden="true" />A writing studio for
              long fiction
            </p>
            <h1
              className="rise-in mt-6 font-serif text-[2.75rem] leading-[1.02] font-medium tracking-[-0.03em] text-stone-900 sm:text-6xl lg:text-[4.25rem]"
              style={stagger(1)}
            >
              Write long stories with an AI that <InkUnderline>remembers</InkUnderline> them.
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
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 transition-colors hover:text-stone-900 hover:decoration-stone-500"
              >
                How Story Memory works
                <ArrowDown className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-y-0.5" />
              </a>
            </div>
          </div>

          <ManuscriptPreview />
        </section>
      </div>

      <main>
        <ProofBand />

        {/* Features */}
        <section id="memory" className="scroll-mt-8 bg-paper-deep">
          <div className="mx-auto max-w-6xl space-y-28 px-5 py-28 sm:px-8 lg:space-y-36">
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
        <section className="hero-atmosphere">
          <div className="mx-auto max-w-6xl px-5 py-28 sm:px-8">
            <Reveal className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-medium text-accent-700">Chapter one starts here</p>
                <h2 className="mt-3 max-w-xl font-serif text-4xl leading-[1.05] font-medium tracking-[-0.025em] text-stone-900 sm:text-6xl">
                  Your next chapter is <InkUnderline>waiting</InkUnderline>.
                </h2>
              </div>
              <InkLink to={startHref} large>
                {startLabel}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </InkLink>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-900/[0.08]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-stone-500 sm:px-8">
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
        "transition-[background-color,transform,box-shadow] duration-200 hover:bg-stone-800 hover:shadow-md active:translate-y-px",
        large ? "h-12 px-6 text-[0.95rem]" : "h-9 px-4 text-sm",
      )}
    >
      {children}
    </Link>
  );
}

/** Italic accent word with a hand-drawn underline that draws itself in */
function InkUnderline({ children }: { children: ReactNode }) {
  const [ref, inView] = useInView<HTMLSpanElement>("0px");
  return (
    <span ref={ref} className="relative inline-block">
      <em className="text-accent-700">{children}</em>
      <svg
        viewBox="0 0 200 12"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute -bottom-1 left-0 h-[0.18em] w-full overflow-visible"
      >
        <path
          d="M2 8 C 40 2, 80 11, 120 6 S 180 3, 198 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={1}
          className="text-accent-500/70 transition-[stroke-dashoffset] delay-500 duration-1000 ease-out motion-reduce:transition-none"
          style={{ strokeDasharray: 1, strokeDashoffset: inView ? 0 : 1 }}
        />
      </svg>
    </span>
  );
}

// ---- Proof band: the evaluation numbers, counted up, over a scrolling genre ribbon ----

function Stat({
  value,
  suffix,
  label,
  start,
}: {
  value: number;
  suffix?: string;
  label: string;
  start: boolean;
}) {
  const shown = useCountUp(value, start);
  return (
    <div>
      <p className="tabular font-serif text-5xl font-medium tracking-[-0.02em] text-paper sm:text-6xl">
        {shown}
        {suffix}
      </p>
      <p className="mt-2 text-sm text-stone-400">{label}</p>
    </div>
  );
}

function ProofBand() {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <section
      aria-labelledby="proof-heading"
      className="relative overflow-hidden bg-stone-900 text-paper"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_20rem_at_85%_0%,rgb(176_80_61/0.35),transparent_70%)]"
      />
      <div ref={ref} className="relative mx-auto max-w-6xl px-5 pt-20 pb-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:items-end">
          <div>
            <p className="text-sm font-medium text-accent-300">Measured, not promised</p>
            <h2
              id="proof-heading"
              className="mt-3 font-serif text-3xl leading-tight font-medium tracking-[-0.02em] sm:text-4xl"
            >
              We planted mistakes in a novel to see what Story Memory catches.
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            <Stat value={8} label="chapters in the test story" start={inView} />
            <Stat value={7} label="contradictions planted" start={inView} />
            <Stat value={76} suffix="%" label="flagged, over 3 runs" start={inView} />
            <Stat value={0} label="false alarms" start={inView} />
          </div>
        </div>
      </div>
      <div className="relative border-t border-white/10 py-5" aria-hidden="true">
        <div className="marquee flex w-max gap-10 font-serif text-xl text-stone-400 italic">
          {[...GENRES, ...GENRES].map((genre, i) => (
            <span key={i} className="flex items-center gap-10">
              {genre}
              <span className="text-accent-400 not-italic">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- Features ----

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
      <Reveal className={cn(flip && "lg:order-2")}>
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
      </Reveal>
      <Reveal className={cn(flip && "lg:order-1")} delay={150}>
        <div aria-hidden="true">{visual}</div>
      </Reveal>
    </article>
  );
}

// ---- Illustrations: simplified, animated copies of the real UI ----

function Page({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("rounded-md bg-white shadow-page ring-1 ring-stone-900/[0.06]", className)}
      style={style}
    >
      {children}
    </div>
  );
}

const HERO_TEXT =
  "The lamp had not been lit in eleven years. Elspeth climbed the last of the iron stairs and looked out over the black water, her ";

function ManuscriptPreview() {
  // Type the opening, then mark the contradiction, then slide in the margin note
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), 700);
    return () => clearTimeout(timer);
  }, []);
  const typed = useTypewriter(HERO_TEXT, started, 2, 26);
  const [flagged, setFlagged] = useState(false);
  useEffect(() => {
    if (!typed.done) return;
    const timer = setTimeout(() => setFlagged(true), prefersReducedMotion() ? 0 : 500);
    return () => clearTimeout(timer);
  }, [typed.done]);

  return (
    <div
      className="rise-in relative mx-auto w-full max-w-lg lg:mr-0"
      style={stagger(2)}
      aria-hidden="true"
    >
      <FloatingChip className="-top-6 -left-4 sm:-left-10" tilt="-3deg" delay="0s">
        <BookMarked className="h-3.5 w-3.5 text-accent-600" />
        Story Bible · 14 entries
      </FloatingChip>

      <Page className="relative rotate-[0.6deg] px-8 pt-9 pb-14 sm:px-11">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium tracking-[0.16em] text-stone-400 uppercase">
            Chapter 7
          </p>
          <span className="tabular flex items-center gap-1.5 text-xs text-stone-400">
            <Check className="h-3 w-3" /> Saved · 2,418 words
          </span>
        </div>
        <p className="mt-2 font-serif text-2xl font-medium text-stone-900">The Lighthouse</p>
        <p className="mt-6 min-h-[9.5rem] font-serif text-[1.05rem] leading-[1.75] text-stone-700">
          {typed.text}
          {typed.done && (
            <>
              <span
                className={cn(
                  "decoration-wavy decoration-1 underline-offset-4 transition-colors duration-500",
                  flagged ? "bg-accent-50 underline decoration-accent-500" : "",
                )}
              >
                brown eyes
              </span>{" "}
              narrowed against the wind.
            </>
          )}
          <span className="caret ml-0.5 inline-block h-[1.1em] w-px translate-y-[3px] bg-stone-800" />
        </p>
      </Page>

      <div
        className={cn(
          "relative -mt-10 ml-auto w-[80%] -rotate-[1.2deg] transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] sm:-mr-8",
          flagged ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        )}
      >
        <div className="rounded-md border border-accent-200/80 bg-[#fdf8f5] p-4 shadow-book">
          <p className="flex items-center gap-2 text-xs font-semibold text-accent-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-500" />
            </span>
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

      <FloatingChip className="bottom-24 -left-6 sm:-left-14" tilt="2deg" delay="-3s">
        <FileText className="h-3.5 w-3.5 text-stone-500" />
        The Lighthouse.epub
      </FloatingChip>
    </div>
  );
}

function FloatingChip({
  className,
  tilt,
  delay,
  children,
}: {
  className: string;
  tilt: string;
  delay: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "drift absolute z-10 hidden items-center gap-1.5 rounded-full border border-stone-900/10 bg-white/90 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-book backdrop-blur sm:flex",
        className,
      )}
      style={{ "--tilt": tilt, "--drift-delay": delay } as CSSProperties}
    >
      {children}
    </div>
  );
}

function StoryBibleVisual() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const entries = [
    { name: "Elspeth Gunn", kind: "Character", facts: ["eye colour: grey", "age: 19"] },
    { name: "Eilean Dubh", kind: "Place", facts: ["lighthouse on the north cliff"] },
    { name: "The Kittiwake", kind: "Item", facts: ["her father's boat"] },
  ];
  return (
    <div ref={ref}>
      <Page className="mx-auto max-w-md p-5">
        <div className="flex items-center justify-between">
          <p className="font-serif text-lg font-medium text-stone-900">Story Bible</p>
          <span className="flex items-center gap-1.5 text-xs text-stone-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Reading chapter 8…
          </span>
        </div>
        <ul className="mt-4 divide-y divide-stone-100">
          {entries.map((entry, i) => (
            <li
              key={entry.name}
              className={cn(
                "py-3 transition-[opacity,transform] duration-500 ease-out",
                inView ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0",
              )}
              style={{ transitionDelay: `${300 + i * 180}ms` }}
            >
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
    </div>
  );
}

const SUGGESTION =
  "Mara's thumb worried the folded corner of the letter until the paper went soft as cloth.";

function CoWriterVisual() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const typed = useTypewriter(SUGGESTION, inView, 1, 32);
  return (
    <div ref={ref} className="relative mx-auto max-w-md">
      <Page className="p-6 font-serif text-[1.02rem] leading-[1.7] text-stone-700">
        <p>
          The ferry was late.{" "}
          <span className="bg-accent-100/70">
            Mara waited by the rail and thought about the letter.
          </span>
        </p>
        <div className="mt-4 rounded-md border-l-2 border-accent-500 bg-paper px-4 py-3 font-sans text-sm leading-relaxed text-stone-700">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-accent-700">
            Show, don't tell
            {!typed.done && <span className="font-normal text-stone-400">writing…</span>}
          </p>
          <p className="min-h-[3.2em] font-serif text-[0.98rem]">
            {typed.text}
            {!typed.done && (
              <span className="caret ml-0.5 inline-block h-[1em] w-px translate-y-[2px] bg-stone-800" />
            )}
          </p>
          <div
            className={cn(
              "mt-3 flex gap-2 text-xs transition-opacity duration-500",
              typed.done ? "opacity-100" : "opacity-40",
            )}
          >
            <span className="rounded bg-stone-900 px-2 py-1 text-paper">Replace selection</span>
            <span className="rounded px-2 py-1 text-stone-500">Discard</span>
          </div>
        </div>
      </Page>
      <div className="drift absolute -top-5 right-4 flex gap-1 rounded-md bg-stone-900 p-1 text-xs text-paper shadow-book">
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
  const [ref, inView] = useInView<HTMLDivElement>();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const timers = [400, 1200].map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  const versions = [
    { label: "Before an AI change", when: "just now" },
    { label: "First full draft", when: "2 hours ago", active: true },
    { label: "Autosave", when: "yesterday" },
  ];
  return (
    <div ref={ref} className="mx-auto grid max-w-md gap-3">
      <Page className="p-2">
        {versions.map((version) => (
          <div
            key={version.label}
            className={cn(
              "flex items-center justify-between rounded px-3 py-2.5 text-sm transition-colors duration-500",
              version.active && step >= 1 && "bg-accent-50",
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
        <span
          data-on={step >= 2}
          className="strike-draw text-accent-800 transition-colors duration-700 data-[on=true]:bg-accent-100"
        >
          and stepped into the light
        </span>{" "}
        <span
          className={cn(
            "bg-emerald-100 text-emerald-900 transition-opacity delay-700 duration-700",
            step >= 2 ? "opacity-100" : "opacity-0",
          )}
        >
          and did not step through
        </span>
        .
      </Page>
    </div>
  );
}

function FinishVisual() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const files = ["pdf", "docx", "epub"];
  return (
    <div ref={ref} className="mx-auto flex max-w-md items-end gap-4">
      <div
        className={cn(
          "w-32 shrink-0 rounded-[2px_5px_5px_2px] bg-[#24402f] p-4 pt-6 shadow-book-lift transition-transform duration-700 ease-out",
          inView ? "rotate-[-3deg]" : "rotate-0",
        )}
      >
        <span className="block h-px bg-[#e9dcc0]/50" />
        <span className="mt-0.5 block h-px bg-[#e9dcc0]/50" />
        <p className="mt-6 font-serif text-lg leading-tight text-[#f3ead8]">The Salt Road</p>
        <p className="mt-14 text-[0.55rem] tracking-[0.18em] text-[#e9dcc0]/70 uppercase">
          Edith Moore
        </p>
      </div>
      <div className="flex-1 space-y-2.5">
        {files.map((extension, i) => (
          <Page
            key={extension}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 text-sm transition-[opacity,transform] duration-500 ease-out",
              inView ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0",
            )}
            style={{ transitionDelay: `${i * 150}ms` }}
          >
            <FileText className="h-4 w-4 text-stone-400" />
            <span className="text-stone-800">The Salt Road.{extension}</span>
            <Check className="ml-auto h-3.5 w-3.5 text-emerald-600" />
          </Page>
        ))}
        <Page className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <Globe className="h-4 w-4 text-accent-600" />
          <span className="truncate text-stone-800">/read/the-salt-road</span>
          <span className="ml-auto rounded-[3px] bg-accent-50 px-1.5 py-px text-[0.6rem] font-semibold tracking-wide text-accent-700 uppercase">
            Live
          </span>
        </Page>
      </div>
    </div>
  );
}
