import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { apiBlob } from "../../lib/api";
import { errorMessage } from "../../lib/form-errors";

type Format = "pdf" | "docx";

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
      <Button
        variant="secondary"
        size="sm"
        loading={exporting === "pdf"}
        disabled={exporting !== null}
        onClick={() => void download("pdf")}
      >
        {exporting !== "pdf" && <Download className="h-4 w-4" />}
        PDF
      </Button>
      <Button
        variant="secondary"
        size="sm"
        loading={exporting === "docx"}
        disabled={exporting !== null}
        onClick={() => void download("docx")}
      >
        {exporting !== "docx" && <Download className="h-4 w-4" />}
        Word
      </Button>
    </div>
  );
}
