import { useEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(rootMargin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  // Without IntersectionObserver (old browsers, some test environments), just show everything
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView] as const;
}

/**
 * Reveals `text` a few characters at a time once `start` is true, like the
 * AI streaming a suggestion. Shows the whole text at once for reduced motion.
 */
export function useTypewriter(text: string, start: boolean, charsPerTick = 2, tickMs = 28) {
  const [instant] = useState(prefersReducedMotion);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!start || instant) return;
    const timer = setInterval(() => {
      setShown((count) => {
        if (count >= text.length) {
          clearInterval(timer);
          return count;
        }
        return Math.min(text.length, count + charsPerTick);
      });
    }, tickMs);
    return () => clearInterval(timer);
  }, [text, start, instant, charsPerTick, tickMs]);

  const length = instant && start ? text.length : shown;
  return { text: text.slice(0, length), done: length >= text.length };
}

/** Counts from 0 to `target` with an ease-out curve once `start` is true. */
export function useCountUp(target: number, start: boolean, durationMs = 1400) {
  const [instant] = useState(prefersReducedMotion);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start || instant) return;
    let frame = 0;
    const began = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / durationMs);
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, start, instant, durationMs]);

  return instant && start ? target : value;
}
