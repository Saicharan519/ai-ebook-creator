import { useHealth } from "./use-health";

export function ApiStatus() {
  const { data, isPending, isError } = useHealth();

  const [label, dotClass] = isPending
    ? ["Checking API…", "bg-gray-400"]
    : isError
      ? ["API unreachable", "bg-red-500"]
      : data.status === "ok"
        ? ["API and database online", "bg-emerald-500"]
        : ["API online, database down", "bg-amber-500"];

  return (
    <p role="status" className="inline-flex items-center gap-2 text-sm text-gray-600">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
      {label}
    </p>
  );
}
