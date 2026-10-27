import type { Book } from "@ebook/shared";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { errorMessage } from "../../lib/form-errors";
import { usePublishBook } from "./books-api";

const readerUrl = (slug: string) => `${window.location.origin}/read/${slug}`;

interface PublishDialogProps {
  book: Book;
  open: boolean;
  onClose: () => void;
  /** Saves pending edits, so readers see the latest text */
  flushPending: () => Promise<void>;
}

/** Publishes the book to a public, read-only page, or takes it down again. */
export function PublishDialog({ book, open, onClose, flushPending }: PublishDialogProps) {
  const publish = usePublishBook(book.id);
  const [copied, setCopied] = useState(false);
  const isPublished = book.status === "published" && book.slug !== null;
  const url = book.slug ? readerUrl(book.slug) : "";

  async function handlePublish() {
    await flushPending();
    publish.mutate(true);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <Modal open={open} onClose={onClose} title={isPublished ? "Published" : "Publish your book"}>
      <div className="space-y-4 text-sm text-stone-700">
        {isPublished ? (
          <>
            <p>Anyone with this link can read your book. Changes you make show up right away.</p>
            <div className="flex gap-2">
              <label htmlFor="reader-link" className="sr-only">
                Public link
              </label>
              <input
                id="reader-link"
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm"
              />
              <Button variant="secondary" onClick={() => void copyLink()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-violet-600 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Open the reader page
              </a>
              <Button
                variant="secondary"
                loading={publish.isPending}
                onClick={() => publish.mutate(false)}
              >
                Unpublish
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>
              Your book gets a public page where anyone with the link can read it, without an
              account. Chapters with no text yet are left out.
            </p>
            <p className="text-stone-500">
              Your premise, notes, Story Bible, and what-if branches stay private. You can unpublish
              at any time{book.slug ? ", and republishing keeps the same link" : ""}.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button loading={publish.isPending} onClick={() => void handlePublish()}>
                Publish
              </Button>
            </div>
          </>
        )}
        {publish.isError && (
          <p role="alert" className="text-red-600">
            {errorMessage(publish.error)}
          </p>
        )}
      </div>
    </Modal>
  );
}
