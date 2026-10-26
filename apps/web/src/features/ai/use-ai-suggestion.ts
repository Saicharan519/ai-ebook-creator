import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../../lib/form-errors";
import { streamAi } from "./ai-api";

export interface SuggestionRequest {
  path: string;
  body: unknown;
}

export type SuggestionState =
  | { status: "idle" }
  | { status: "streaming"; text: string }
  /** `stopped` means the user pressed Stop; the partial text can still be used */
  | { status: "done"; text: string; stopped: boolean }
  | { status: "error"; text: string; message: string };

/** Runs one streamed AI request at a time and collects its text. */
export function useAiSuggestion() {
  const [state, setState] = useState<SuggestionState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);
  const lastRequest = useRef<SuggestionRequest | null>(null);

  const start = useCallback(async (request: SuggestionRequest) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    lastRequest.current = request;

    let text = "";
    setState({ status: "streaming", text });
    try {
      await streamAi(request.path, request.body, {
        signal: current.signal,
        onText: (piece) => {
          text += piece;
          setState({ status: "streaming", text });
        },
      });
      setState({ status: "done", text, stopped: false });
    } catch (error) {
      if (current.signal.aborted) {
        // Stopped by the user, or replaced by a newer request
        if (controller.current === current) setState({ status: "done", text, stopped: true });
        return;
      }
      setState({ status: "error", text, message: errorMessage(error) });
    }
  }, []);

  const stop = useCallback(() => controller.current?.abort(), []);

  const reset = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState({ status: "idle" });
  }, []);

  const retry = useCallback(() => {
    if (lastRequest.current) void start(lastRequest.current);
  }, [start]);

  // Leaving the page cancels the request, which also stops the model on the server
  useEffect(() => () => controller.current?.abort(), []);

  return { state, start, stop, reset, retry };
}
