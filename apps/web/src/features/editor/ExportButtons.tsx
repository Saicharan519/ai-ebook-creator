import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { apiBlob } from "../../lib/api";
import { errorMessage } from "../../lib/form-errors";

const FORMATS = [
  { format: "pdf", label: "PDF" },
  { format: "docx", label: "Word" },
  { format: "epub", label: "EPUB" },
] as const;

type Format = (typeof FORMATS)[number]["format"];

/** Characters Windows and macOS don't allow in file names */
const safeFileName = (title: string) => title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "book";

export function ExportButtons({
  bookId,
  title,
  beforeExport,
}: {
  bookId: string;
  title: string;
  beforeExport: () => Promise<void>;
}) {
  const [exporting, setExporting] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {error && (
        <span role="alert" className="mr-2 hidden text-xs text-red-600 lg:inline">
          Export failed: {error}
        </span>
      )}
      {FORMATS.map(({ format, label }) => (
        <Button
          key={format}
          variant="secondary"
          size="sm"
          loading={exporting === format}
          disabled={exporting !== null}
          onClick={() => void download(format)}
          title={`Download as ${label}`}
        >
          {exporting !== format && <Download className="h-4 w-4" />}
          {label}
        </Button>
      ))}
    </div>
  );
}
