import "dotenv/config";

export function appOrigin() {
  try {
    const url = new URL(process.env.APP_URL ?? "");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error(
      "APP_URL must be the frontend origin (HTTPS in production), without a path or credentials.",
    );
  }
}

export function emailEnabled() {
  const mode = process.env.EMAIL_MODE;
  if (mode !== "disabled" && mode !== "ethereal" && mode !== "smtp") {
    throw new Error("EMAIL_MODE must be disabled, ethereal or smtp.");
  }
  return mode !== "disabled";
}

export function emailSettings() {
  if (!emailEnabled())
    return { mode: "disabled" as const, from: undefined, smtp: undefined };
  const mode = process.env.EMAIL_MODE;
  if (mode === "ethereal" && process.env.NODE_ENV === "production")
    throw new Error("Ethereal email mode is not allowed in production.");
  const from = process.env.EMAIL_FROM?.trim();
  if (!from || /[\r\n]/.test(from) || !from.includes("@"))
    throw new Error("EMAIL_FROM must contain a sender email address.");
  let smtp;
  if (mode === "smtp") {
    try {
      const url = new URL(process.env.SMTP_URL ?? "");
      if (
        !["smtp:", "smtps:"].includes(url.protocol) ||
        !url.hostname ||
        url.search ||
        url.hash ||
        (url.pathname && url.pathname !== "/")
      )
        throw new Error();
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      smtp = {
        host: url.hostname,
        port: Number(url.port || (url.protocol === "smtps:" ? 465 : 587)),
        secure: url.protocol === "smtps:",
        requireTLS: !local || process.env.NODE_ENV === "production",
        auth: url.username
          ? {
              user: decodeURIComponent(url.username),
              pass: decodeURIComponent(url.password),
            }
          : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      };
    } catch {
      throw new Error(
        "SMTP_URL must be an smtp:// or smtps:// connection URL without query options.",
      );
    }
  }
  return { mode, from, smtp };
}

export function validateEmailConfiguration() {
  emailSettings();
  appOrigin();
  if (
    process.env.AUTH_REQUIRE_EMAIL_VERIFICATION &&
    !["true", "false"].includes(process.env.AUTH_REQUIRE_EMAIL_VERIFICATION)
  ) {
    throw new Error("AUTH_REQUIRE_EMAIL_VERIFICATION must be true or false.");
  }
  if (
    !emailEnabled() &&
    process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true"
  ) {
    throw new Error(
      "Email verification cannot be required when EMAIL_MODE=disabled.",
    );
  }
}
