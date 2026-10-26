import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

interface AutosaveOptions<T> {
  value: T;
  save: (value: T) => Promise<unknown>;
  /** Must be a stable function (defined outside the component). */
  isEqual: (a: T, b: T) => boolean;
  /** Quiet time after the last change before saving */
  delay?: number;
}

const MAX_RETRY_DELAY = 30_000;

/**
 * Saves `value` a moment after it stops changing. Saves run one at a time, in
 * order, so an older save can never overwrite a newer one. Failed saves retry
 * with growing delays, and anything unsaved is flushed when the component unmounts.
 */
export function useAutosave<T>({ value, save, isEqual, delay = 800 }: AutosaveOptions<T>) {
  const [savedValue, setSavedValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [failures, setFailures] = useState(0);

  const latest = useRef(value);
  const lastSaved = useRef(value);
  const saveRef = useRef(save);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    latest.current = value;
    saveRef.current = save;
  });

  const flush = useCallback((): Promise<void> => {
    queue.current = queue.current.then(async () => {
      const toSave = latest.current;
      if (isEqual(toSave, lastSaved.current)) return;

      setSaving(true);
      try {
        await saveRef.current(toSave);
        lastSaved.current = toSave;
        setSavedValue(toSave);
        setFailures(0);
      } catch {
        setFailures((count) => count + 1);
      } finally {
        setSaving(false);
      }
    });
    return queue.current;
  }, [isEqual]);

  const dirty = !isEqual(value, savedValue);

  useEffect(() => {
    if (!dirty) return;
    const wait = failures > 0 ? Math.min(2_000 * 2 ** failures, MAX_RETRY_DELAY) : delay;
    const timer = setTimeout(() => void flush(), wait);
    return () => clearTimeout(timer);
  }, [value, dirty, failures, delay, flush]);

  // Don't lose the last few keystrokes when switching chapters or leaving the page
  useEffect(() => () => void flush(), [flush]);

  const status: SaveStatus = saving
    ? "saving"
    : failures > 0
      ? "error"
      : dirty
        ? "unsaved"
        : "saved";

  return { status, flush };
}
