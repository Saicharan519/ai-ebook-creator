import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}

/**
 * Built on the native <dialog> element, which handles focus trapping,
 * Escape to close, and hiding the rest of the page from screen readers.
 */
export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself
      onClick={(event) => event.target === ref.current && onClose()}
      aria-labelledby="modal-title"
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-xl bg-white p-0 shadow-xl backdrop:bg-stone-900/40",
        size === "lg" ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
            <h2 id="modal-title" className="text-lg font-semibold text-stone-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
