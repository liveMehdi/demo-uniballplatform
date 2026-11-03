import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

const field =
  "min-h-10 w-full max-w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  const styles =
    type === "checkbox" || type === "radio"
      ? "size-4 shrink-0 accent-accent disabled:opacity-50"
      : field;
  return (
    <input type={type} className={twMerge(styles, className)} {...props} />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={twMerge(field, "w-auto", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={twMerge(field, "min-h-28 resize-y", className)}
      {...props}
    />
  );
}
