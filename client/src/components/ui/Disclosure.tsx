import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export function Disclosure({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"details"> & { tone?: "neutral" | "danger" }) {
  return (
    <details
      className={twMerge(
        "min-w-0 rounded-md border border-line bg-surface p-5 [&>summary]:cursor-pointer [&>summary]:text-sm [&>summary]:font-medium [&>summary]:text-ink [&[open]>summary]:mb-4",
        tone === "danger" && "border-red-400/25 [&>summary]:text-red-300",
        className,
      )}
      {...props}
    />
  );
}
