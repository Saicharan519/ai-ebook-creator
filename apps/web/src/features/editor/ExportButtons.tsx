import { ChevronDown, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { apiBlob } from "../../lib/api";
import { errorMessage } from "../../lib/form-errors";

const FORMATS = [
  { format: "pdf", label: "PDF", hint: "Typeset, with page numbers" },
  { format: "docx", label: "Word", hint: "To keep editing elsewhere" },
  { format: "epub", label: "EPUB", hint: "For e-readers" },
] as const;

type Format = (typeof FORMATS)[number]["format"];

/** Characters Windows and macOS don't allow in file names */
const safeFileName = (title: string) => title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "book";

/** One "Export" button that opens a small menu of formats. */
export function ExportButtons({
  bookId,
  title,
  beforeExport,
}: {
  bookId: string;
  title: string;
  beforeExport: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function download(format: Format) {
    setExporting(format);
    setError(null);
    try {
      // Export what the user sees, including the last few keystrokes
      await beforeExport();
      const blob = await apiBlob(`/books/${bookId}/export/${format}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeFileName(title)}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        {exporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
      </Button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 origin-top-right rounded-lg border border-stone-200/80 bg-white p-1.5 shadow-xl shadow-stone-900/10">
          <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-stone-500">Download as</p>
          {FORMATS.map(({ format, label, hint }) => (
            <button
              key={format}
              type="button"
              disabled={exporting !== null}
              onClick={() => void download(format)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-paper disabled:opacity-60"
            >
              <span>
                <span className="block text-sm font-medium text-stone-900">{label}</span>
                <span className="block text-xs text-stone-500">{hint}</span>
              </span>
              {exporting === format && <Spinner className="h-4 w-4 text-accent-600" />}
            </button>
          ))}
          {error && (
            <p role="alert" className="mx-2.5 my-1.5 text-xs text-accent-700">
              Export failed: {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
