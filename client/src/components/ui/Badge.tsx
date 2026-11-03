import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

const tones = {
  neutral: "border-accent/40 bg-accent/10 text-accent",
  danger: "border-red-400/25 bg-red-400/10 text-red-300",
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
};
export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={twMerge(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
