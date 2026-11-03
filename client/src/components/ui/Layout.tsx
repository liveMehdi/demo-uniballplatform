import type { ComponentProps, HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "aside";
};
export function Card({ as: Tag = "div", className, ...props }: CardProps) {
  return (
    <Tag
      className={twMerge(
        "min-w-0 rounded-md border border-line bg-surface p-5",
        className,
      )}
      {...props}
    />
  );
}

export function Page({
  wide = false,
  className,
  ...props
}: ComponentProps<"main"> & { wide?: boolean }) {
  return (
    <main
      className={twMerge(
        "mx-auto w-full min-w-0 px-6 py-8 text-sm max-sm:px-4",
        wide ? "max-w-[1400px]" : "max-w-[1200px]",
        className,
      )}
      {...props}
    />
  );
}

export function TableScroll({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={twMerge(
        "max-w-full overflow-x-auto rounded-md border border-line bg-surface",
        className,
      )}
      {...props}
    />
  );
}
