import { LoaderCircle } from "lucide-react";
import { cn } from "../../lib/cn";

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn("animate-spin", className)} aria-hidden="true" />;
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status">
      <Spinner className="h-6 w-6 text-accent-600" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
