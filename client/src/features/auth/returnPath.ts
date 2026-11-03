export function safeReturnPath(value: string | null): string {
  if (!value) return "/events";
  try {
    const decoded = decodeURIComponent(value);
    const hasControlCharacter = [...decoded].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    );
    if (
      !value.startsWith("/") ||
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      hasControlCharacter
    )
      return "/events";
    const url = new URL(value, "https://app.invalid");
    if (
      url.origin !== "https://app.invalid" ||
      [
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
      ].includes(
        decodeURIComponent(url.pathname).replace(/\/+$/, "").toLowerCase(),
      )
    )
      return "/events";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/events";
  }
}

export function authPath(
  mode:
    | "login"
    | "register"
    | "forgot-password"
    | "reset-password"
    | "verify-email",
  returnTo: string,
) {
  return `/${mode}?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
