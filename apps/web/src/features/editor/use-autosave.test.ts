import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "./use-autosave";

const isEqual = (a: string, b: string) => a === b;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(save: (value: string) => Promise<unknown>) {
  return renderHook(({ value }) => useAutosave({ value, save, isEqual, delay: 800 }), {
    initialProps: { value: "first" },
  });
}

describe("useAutosave", () => {
  it("starts as saved and doesn't save the initial value", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result } = setup(save);

    await act(() => vi.advanceTimersByTimeAsync(5_000));

    expect(result.current.status).toBe("saved");
    expect(save).not.toHaveBeenCalled();
  });

  it("waits for typing to pause, then saves only the latest value", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = setup(save);

    rerender({ value: "a" });
    await act(() => vi.advanceTimersByTimeAsync(500));
    rerender({ value: "ab" });
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(result.current.status).toBe("unsaved");
    expect(save).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("ab");
    expect(result.current.status).toBe("saved");
  });

  it("retries after a failed save", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const { result, rerender } = setup(save);

    rerender({ value: "changed" });
    await act(() => vi.advanceTimersByTimeAsync(800));
    expect(result.current.status).toBe("error");

    await act(() => vi.advanceTimersByTimeAsync(4_000));
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
  });

  it("flush saves immediately", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = setup(save);

    rerender({ value: "urgent" });
    await act(() => result.current.flush());

    expect(save).toHaveBeenCalledWith("urgent");
  });

  it("saves pending changes on unmount", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = setup(save);

    rerender({ value: "last words" });
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(save).toHaveBeenCalledWith("last words");
  });

  it("never runs two saves at once", async () => {
    let finishFirst!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (finishFirst = resolve)))
      .mockResolvedValue(undefined);
    const { rerender } = setup(save);

    rerender({ value: "one" });
    await act(() => vi.advanceTimersByTimeAsync(800));
    rerender({ value: "two" });
    await act(() => vi.advanceTimersByTimeAsync(800));
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => finishFirst());
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("two");
  });
});
