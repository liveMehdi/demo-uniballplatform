import type { ComponentProps } from "react";
import { Link, useLocation } from "react-router";
import { authPath } from "../returnPath";

export default function LoginLink(
  props: Omit<ComponentProps<typeof Link>, "to">,
) {
  const location = useLocation();
  return (
    <Link
      {...props}
      to={authPath(
        "login",
        `${location.pathname}${location.search}${location.hash}`,
      )}
    />
  );
}
