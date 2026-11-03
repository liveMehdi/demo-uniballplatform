import { authPath } from "../returnPath";
import LoginLink from "./LoginLink";
import { Button } from "../../../components/ui/Button";
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../../lib/auth-client";
import { useEmailAvailability } from "../useEmailAvailability";

export default function AuthStatus() {
  const { data: emailEnabled } = useEmailAvailability();
  const { data: session, isPending, error } = authClient.useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setSigningOut(true);
    setLogoutError(null);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setLogoutError(result.error.message ?? "Could not log out");
        return;
      }

      queryClient.clear();
      navigate("/login");
    } catch {
      setLogoutError("Could not connect. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  if (isPending) return <p>Checking session...</p>;
  if (error) return <p role="alert">Could not check your session.</p>;

  if (!session) {
    return (
      <p>
        <LoginLink>Log in</LoginLink>{" "}
        <Link
          to={authPath(
            "register",
            `${location.pathname}${location.search}${location.hash}`,
          )}
        >
          Register
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 max-sm:gap-1">
      <span className="max-sm:hidden">{session.user.name}</span>
      {emailEnabled && !session.user.emailVerified && (
        <Link
          to={authPath(
            "verify-email",
            `${location.pathname}${location.search}${location.hash}`,
          )}
        >
          Verify email
        </Link>
      )}

      <Button
        variant="secondary"
        type="button"
        onClick={handleLogout}
        disabled={signingOut}
      >
        {signingOut ? "Logging out..." : "Log out"}
      </Button>

      {logoutError && <p role="alert">{logoutError}</p>}
    </div>
  );
}
