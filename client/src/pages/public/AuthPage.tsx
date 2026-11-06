import AuthLayout from "../../features/auth/components/AuthLayout";
import { authPath, safeReturnPath } from "../../features/auth/returnPath";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Fields";
import { useState } from "react";
import type { SubmitEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../lib/auth-client";
import { useAppConfig } from "../../features/auth/useAppConfig";

type Props = {
  mode: "login" | "register";
};

export default function AuthPage({ mode }: Props) {
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo"));
  const registering = mode === "register";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const appConfig = useAppConfig();
  const emailEnabled = appConfig.data?.emailEnabled === true;
  const demo = appConfig.data?.demoAccount;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registering && appConfig.data === undefined) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    setPending(true);
    setError(null);

    try {
      const result = registering
        ? await authClient.signUp.email({
            name: String(formData.get("name") ?? ""),
            email,
            password,
            callbackURL: emailEnabled
              ? new URL(
                  authPath("verify-email", returnTo),
                  window.location.origin,
                ).toString()
              : undefined,
          })
        : await authClient.signIn.email({
            email,
            password,
          });

      if (result.error) {
        if (emailEnabled && result.error.code === "EMAIL_NOT_VERIFIED") {
          navigate(authPath("verify-email", returnTo), { state: { email } });
          return;
        }
        setError(result.error.message ?? "Authentication failed");
        return;
      }

      queryClient.clear();
      navigate(
        registering && emailEnabled
          ? authPath("verify-email", returnTo)
          : returnTo,
        {
          replace: true,
          state:
            registering && emailEnabled
              ? { email, verificationRequested: true }
              : undefined,
        },
      );
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <header className="mb-8">
        <h1 id="auth-heading">
          {registering ? "Create an account" : "Welcome back"}
        </h1>
        <p className="text-muted">
          {registering
            ? "Register with your email to start planning your evening."
            : "Sign in to access your bookings and tickets."}
        </p>
      </header>
      {!registering && demo && (
        <section
          aria-labelledby="demo-heading"
          className="mb-6 rounded-lg border border-line bg-surface p-4"
        >
          <h2 id="demo-heading" className="text-lg font-semibold">
            Try the demo
          </h2>
          <p className="mt-2 text-sm text-muted">
            Explore with a shared organiser account. Changes are visible to
            everyone, so please use sample data only.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            disabled={pending}
            onClick={() => {
              setEmail(demo.email);
              setPassword(demo.password);
              setShowPassword(false);
              setError(null);
            }}
          >
            Use demo admin account
          </Button>
          <p className="mt-2 text-sm text-muted">Then select Sign in below.</p>
        </section>
      )}
      <form className="w-full max-w-none" onSubmit={handleSubmit}>
        <fieldset
          className="mb-0"
          disabled={pending || (registering && appConfig.data === undefined)}
        >
          <legend className="sr-only">
            {registering ? "Registration details" : "Sign-in details"}
          </legend>
          {registering && (
            <div className="mb-4">
              <label htmlFor="name">Name</label>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Your full name"
                className="min-h-12"
                required
              />
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email">Email</label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="min-h-12"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password">Password</label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={registering ? 8 : undefined}
                maxLength={128}
                autoComplete={registering ? "new-password" : "current-password"}
                className="min-h-12 pr-20"
                aria-describedby={registering ? "password-help" : undefined}
                required
              />
              <Button
                variant="secondary"
                type="button"
                className="absolute inset-y-1 right-1 mt-0 min-h-0 border-transparent bg-transparent px-3 text-xs"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-controls="password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? "Hide" : "Show"}
              </Button>
            </div>
            {registering && (
              <p id="password-help" className="mt-2 text-muted">
                Use at least 8 characters.
              </p>
            )}
          </div>

          {!registering && emailEnabled && (
            <p className="text-right">
              <Link to={authPath("forgot-password", returnTo)}>
                Forgot password?
              </Link>
            </p>
          )}
          <Button className="mt-2 min-h-12 w-full" type="submit">
            {pending
              ? "Please wait..."
              : registering
                ? "Create account"
                : "Sign in"}
          </Button>
        </fieldset>

        {error && <p role="alert">{error}</p>}
        {registering && appConfig.isPending && (
          <p role="status">Loading app settings...</p>
        )}
        {appConfig.isError && (
          <p role="alert">
            Could not load app settings.{" "}
            <Button
              variant="secondary"
              type="button"
              onClick={() => void appConfig.refetch()}
            >
              Try again
            </Button>
          </p>
        )}
      </form>

      <p className="mt-6 border-t border-line pt-6 text-center text-muted">
        {registering ? (
          <>
            Already registered?{" "}
            <Link to={authPath("login", returnTo)}>Sign in</Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link to={authPath("register", returnTo)}>Create an account</Link>
          </>
        )}
      </p>
    </AuthLayout>
  );
}
