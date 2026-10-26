import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import type { SaveStatus } from "./use-autosave";

export function SaveStatusBadge({ status }: { status: SaveStatus }) {
  const content = {
    saved: (
      <>
        <Check className="h-3.5 w-3.5" /> Saved
      </>
    ),
    unsaved: <>Unsaved changes</>,
    saving: (
      <>
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Saving…
      </>
    ),
    error: (
      <span className="flex items-center gap-1 text-red-600">
        <AlertCircle className="h-3.5 w-3.5" /> Not saved, retrying
      </span>
    ),
  }[status];

  return (
    <span role="status" className="flex shrink-0 items-center gap-1 text-xs text-stone-500">
      {content}
    </span>
  );
}
