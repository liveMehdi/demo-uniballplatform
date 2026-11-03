import type { ComponentProps } from "react";
import { Link } from "react-router";
import { twMerge } from "tailwind-merge";

type Variant = "primary" | "secondary" | "danger";
const base =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold no-underline cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary:
    "border-accent bg-accent text-canvas hover:bg-accent-hover hover:text-canvas",
  secondary:
    "border-accent/60 bg-surface text-accent hover:bg-raised hover:text-accent-hover",
  danger:
    "border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20 hover:text-red-200",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      className={twMerge(base, variants[variant], className)}
      {...props}
    />
  );
}

export function LinkButton({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link className={twMerge(base, variants[variant], className)} {...props} />
  );
}
