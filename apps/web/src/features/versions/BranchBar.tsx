import type { BranchSummary } from "@ebook/shared";
import { Check, GitBranch, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Modal } from "../../components/ui/Modal";
import { TextField } from "../../components/ui/TextField";
import { errorMessage } from "../../lib/form-errors";
import { useCreateBranch, useDeleteBranch, useKeepBranch } from "./versions-api";

interface BranchBarProps {
  bookId: string;
  chapterId: string;
  branches: BranchSummary[];
  /** The branch being edited, or null for the main text */
  activeBranch: BranchSummary | null;
  onSwitch: (branchId: string | null) => void;
  /** Saves pending edits before the text is copied or replaced */
  flushPending: () => Promise<void>;
  /** The main text was replaced by a kept branch */
  onKept: () => void;
}

/**
 * Switches between a chapter's main text and its what-if branches. A branch is
 * a separate draft: try a different direction, then keep it or throw it away.
 */
export function BranchBar({
  bookId,
  chapterId,
  branches,
  activeBranch,
  onSwitch,
  flushPending,
  onKept,
}: BranchBarProps) {
  const createBranch = useCreateBranch(bookId, chapterId);
  const keepBranch = useKeepBranch(bookId, chapterId);
  const deleteBranch = useDeleteBranch(bookId, chapterId);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<"keep" | "discard" | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) return;
    // The branch starts as a copy of the main text, so save it first
    await flushPending();
    createBranch.mutate(
      { name },
      {
        onSuccess: (branch) => {
          setCreating(false);
          onSwitch(branch.id);
        },
      },
    );
  }

  async function handleKeep() {
    if (!activeBranch) return;
    await flushPending();
    keepBranch.mutate(activeBranch.id, {
      onSuccess: () => {
        setConfirm(null);
        onSwitch(null);
        onKept();
      },
    });
  }

  function handleDiscard() {
    if (!activeBranch) return;
    deleteBranch.mutate(activeBranch.id, {
      onSuccess: () => {
        setConfirm(null);
        onSwitch(null);
      },
    });
  }

  const bar =
    branches.length === 0 ? (
      <div className="mx-auto flex max-w-3xl justify-end px-4 pt-3 sm:px-8">
        <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
          <GitBranch className="h-4 w-4 text-violet-600" />
          Try a what-if
        </Button>
      </div>
    ) : (
      <div
        className={
          activeBranch
            ? "border-b border-amber-200 bg-amber-50"
            : "border-b border-stone-200 bg-stone-50"
        }
      >
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-2 sm:px-8">
          <GitBranch className="h-4 w-4 text-violet-600" aria-hidden />
          <label htmlFor="branch-select" className="sr-only">
            Version of this chapter
          </label>
          <select
            id="branch-select"
            value={activeBranch?.id ?? ""}
            onChange={(e) => onSwitch(e.target.value || null)}
            className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm"
          >
            <option value="">Main text</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                What if: {branch.name}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New what-if
          </Button>

          {activeBranch && (
            <div className="ml-auto flex items-center gap-1">
              <span className="mr-1 hidden text-xs text-amber-800 sm:inline">
                Story Memory ignores this draft until you keep it.
              </span>
              <Button size="sm" onClick={() => setConfirm("keep")}>
                <Check className="h-4 w-4" />
                Keep this version
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Discard this what-if"
                title="Discard this what-if"
                onClick={() => setConfirm("discard")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );

  return (
    <>
      {bar}

      <CreateBranchDialog
        open={creating}
        loading={createBranch.isPending}
        error={createBranch.error}
        onSubmit={(e) => void handleCreate(e)}
        onClose={() => setCreating(false)}
      />

      <ConfirmDialog
        open={confirm === "keep"}
        title="Keep this what-if?"
        confirmLabel="Replace main text"
        loading={keepBranch.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void handleKeep()}
      >
        <p>
          <strong>{activeBranch?.name}</strong> becomes this chapter's main text. Your current main
          text is saved in History, so you can get it back.
        </p>
        {keepBranch.isError && (
          <p role="alert" className="mt-2 text-red-600">
            {errorMessage(keepBranch.error)}
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === "discard"}
        title="Discard this what-if?"
        confirmLabel="Discard"
        loading={deleteBranch.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={handleDiscard}
      >
        <strong>{activeBranch?.name}</strong> and its history will be deleted. Your main text isn't
        affected.
      </ConfirmDialog>
    </>
  );
}

interface CreateBranchDialogProps {
  open: boolean;
  loading: boolean;
  error: Error | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

function CreateBranchDialog({ open, loading, error, onSubmit, onClose }: CreateBranchDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="New what-if branch">
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm text-stone-600">
          A copy of this chapter you can change freely. Your main text stays as it is until you
          choose to keep the branch.
        </p>
        <TextField
          label="Name"
          name="name"
          required
          maxLength={80}
          autoFocus
          placeholder="e.g. She refuses the offer"
          error={error ? errorMessage(error) : undefined}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create branch
          </Button>
        </div>
      </form>
    </Modal>
  );
}
