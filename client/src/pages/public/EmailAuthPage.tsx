import { useState } from "react";
import type { SubmitEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../lib/auth-client";
import { authPath, safeReturnPath } from "../../features/auth/returnPath";
import AuthLayout from "../../features/auth/components/AuthLayout";
import { Button, LinkButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Fields";
import { useEmailAvailability } from "../../features/auth/useEmailAvailability";

type Mode = "forgot-password" | "reset-password" | "verify-email";

export default function EmailAuthPage({ mode }: { mode: Mode }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const emailAvailability = useEmailAvailability();
  if (emailAvailability.data !== true) {
    return (
      <AuthLayout>
        <h1 id="auth-heading">Email services</h1>
        {emailAvailability.data === false ? (
          <p>Email is disabled for this demo.</p>
        ) : emailAvailability.isError ? (
          <>
            <p role="alert">Could not load email settings.</p>
            <Button
              type="button"
              onClick={() => void emailAvailability.refetch()}
            >
              Try again
            </Button>
          </>
        ) : (
          <p role="status">Loading app settings...</p>
        )}
        <Link to={authPath("login", safeReturnPath(params.get("returnTo")))}>
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }
  return <EmailAuthForm key={location.key} mode={mode} />;
}

function EmailAuthForm({ mode }: { mode: Mode }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const returnTo = safeReturnPath(params.get("returnTo"));
  const token =
    mode === "forgot-password"
      ? null
      : new URLSearchParams(location.hash.slice(1)).get("token");
  const { data: session, refetch } = authClient.useSession();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(
    location.state?.verificationRequested
      ? "Check your inbox for your verification link."
      : null,
  );
  const [complete, setComplete] = useState(false);
  const verifying = mode === "verify-email";
  const resetting = mode === "reset-password";
  const verified =
    verifying && (complete || (!token && session?.user.emailVerified));
  const title = resetting
    ? "Choose a new password"
    : verifying
      ? "Verify your email"
      : "Forgot your password?";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setError(null);
    if (resetting && values.get("password") !== values.get("confirmPassword")) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const email = String(values.get("email") ?? "").trim();
      const result = resetting
        ? await authClient.resetPassword({
            token: token ?? "",
            newPassword: String(values.get("password")),
          })
        : verifying && token
          ? await authClient.verifyEmail({ query: { token } })
          : verifying
            ? await authClient.sendVerificationEmail({
                email,
                callbackURL: new URL(
                  authPath("verify-email", returnTo),
                  window.location.origin,
                ).toString(),
              })
            : await authClient.requestPasswordReset({
                email,
                redirectTo: new URL(
                  authPath("reset-password", returnTo),
                  window.location.origin,
                ).toString(),
              });
      if (result.error) {
        setError(
          result.error.status === 429
            ? "Please wait a minute before trying again."
            : resetting || (verifying && token)
              ? "This link could not be used. It may have expired or already been used. Request a new email below."
              : (result.error.message ??
                "Could not request an email. Please try again."),
        );
        return;
      }
      if (resetting || (verifying && token)) {
        setComplete(true);
        // keeping the public capability query so this form stays rendered.
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== "email-availability",
        });
        await refetch();
      } else {
        setMessage(
          verifying
            ? "If this account needs verification, a link has been queued. Check your inbox."
            : "If an account exists for that email, a reset link has been queued. Check your inbox.",
        );
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <h1 id="auth-heading">{title}</h1>
      {verified || (resetting && complete) ? (
        <div>
          <p role="status">
            {resetting
              ? "Your password has been reset. Sign in with your new password."
              : "Your email address is verified."}
          </p>
          <LinkButton
            to={!resetting && session ? returnTo : authPath("login", returnTo)}
          >
            {!resetting && session ? "Continue" : "Sign in"}
          </LinkButton>
        </div>
      ) : resetting && !token ? (
        <div>
          <p role="alert">This reset link is missing or invalid.</p>
          <Link to={authPath("forgot-password", returnTo)}>
            Request a new reset link
          </Link>
        </div>
      ) : (
        <>
          <p className="text-muted">
            {resetting
              ? "Use 8 to 128 characters. Existing sessions will be signed out."
              : verifying && token
                ? "Confirm your email address to finish verification."
                : "Enter your email address and we will send you a link."}
          </p>
          <form className="max-w-none" onSubmit={handleSubmit}>
            <fieldset disabled={pending}>
              <legend className="sr-only">{title}</legend>
              {resetting ? (
                <>
                  <label htmlFor="password">New password</label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                  <label htmlFor="confirmPassword">Confirm password</label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </>
              ) : (
                !token && (
                  <>
                    <label htmlFor="email">Email</label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      defaultValue={
                        session?.user.email ?? location.state?.email ?? ""
                      }
                      required
                    />
                  </>
                )
              )}
              <Button className="mt-4 w-full" type="submit">
                {pending
                  ? "Please wait..."
                  : resetting
                    ? "Reset password"
                    : verifying && token
                      ? "Verify email"
                      : "Send email"}
              </Button>
            </fieldset>
          </form>
          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}
          {(resetting || (verifying && token)) && (
            <p>
              <Link
                to={authPath(
                  resetting ? "forgot-password" : "verify-email",
                  returnTo,
                )}
              >
                Request a new link
              </Link>
            </p>
          )}
          {verifying && session && !token && (
            <p>
              <Link to={returnTo}>Continue to the app</Link>
            </p>
          )}
        </>
      )}
      <p className="mt-6 border-t border-line pt-6">
        <Link to={authPath("login", returnTo)}>Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
