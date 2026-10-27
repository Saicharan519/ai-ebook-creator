import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

// Primary actions are ink on paper; the accent is kept for highlights and state
const VARIANTS = {
  primary:
    "bg-stone-900 text-paper shadow-sm hover:bg-stone-800 disabled:bg-stone-400 disabled:shadow-none",
  secondary:
    "border border-stone-300/80 bg-white/70 text-stone-800 shadow-[0_1px_0_rgb(68_52_36/0.04)] hover:border-stone-400/70 hover:bg-white disabled:text-stone-400",
  ghost: "text-stone-700 hover:bg-stone-900/5 disabled:text-stone-400",
  danger: "bg-accent-700 text-white hover:bg-accent-800 disabled:bg-accent-300",
};

const SIZES = {
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  icon: "h-8 w-8 justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center rounded-md font-medium tracking-[-0.005em]",
        "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out",
        "active:translate-y-px active:scale-[0.985] disabled:cursor-not-allowed disabled:active:transform-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}
