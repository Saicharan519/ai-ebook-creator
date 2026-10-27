import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const fieldClass =
  "block w-full rounded-md border bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 " +
  "shadow-[inset_0_1px_1px_rgb(68_52_36/0.05)] transition-[border-color,box-shadow] duration-200 " +
  "focus:outline-none focus:ring-[3px] focus:ring-accent-500/15 focus:border-accent-500";

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-stone-500">{hint}</p>
      )}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, className, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(fieldClass, error ? "border-red-400" : "border-stone-300", className)}
        {...props}
      />
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextAreaField({ label, error, hint, className, ...props }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          fieldClass,
          "min-h-24",
          error ? "border-red-400" : "border-stone-300",
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
}
