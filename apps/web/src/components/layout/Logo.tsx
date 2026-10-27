import { cn } from "../../lib/cn";

/** The mark: a page of ink with a bookmark ribbon. Same drawing as the favicon. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("h-7 w-7 shrink-0", className)}>
      <rect width="32" height="32" rx="7" className="fill-stone-900" />
      <path
        d="M9 9h9M9 13.5h11M9 18h7"
        className="stroke-paper"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity=".85"
      />
      <path d="M21 0h5v14l-2.5-2.2L21 14z" className="fill-accent-500" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5 text-stone-900", className)}>
      <LogoMark />
      <span
        className={cn(
          "font-serif text-[1.15rem] leading-none font-medium tracking-[-0.01em]",
          compact && "hidden sm:inline",
        )}
      >
        AI eBook Creator
      </span>
    </span>
  );
}
