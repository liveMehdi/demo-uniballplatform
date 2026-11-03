import type { ComponentProps } from "react";
import { NavLink } from "react-router";
import { twMerge } from "tailwind-merge";

type Props = Omit<ComponentProps<typeof NavLink>, "className"> & {
  layout?: "header" | "sidebar";
  className?: string;
};
export function NavigationLink({
  layout = "header",
  className,
  ...props
}: Props) {
  return (
    <NavLink
      className={twMerge(
        "text-sm text-muted no-underline hover:text-ink aria-[current=page]:text-ink",
        layout === "header"
          ? "border-b-2 border-transparent py-2 aria-[current=page]:border-accent"
          : "rounded px-3 py-2 whitespace-nowrap hover:bg-raised aria-[current=page]:bg-raised",
        className,
      )}
      {...props}
    />
  );
}
