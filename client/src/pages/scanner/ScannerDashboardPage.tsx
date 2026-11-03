import { hasEventFinished } from "../../lib/eventLifecycle";
import LoginLink from "../../features/auth/components/LoginLink";
import { Card, Page } from "../../components/ui/Layout";
import { LinkButton } from "../../components/ui/Button";
import { Link } from "react-router";
import { authClient } from "../../lib/auth-client";
import { useScannerEvents } from "../../features/scanner/hooks";
import { useNow } from "../../lib/useNow";

export default function ScannerDashboardPage() {
  const now = useNow();
  const {
    data: session,
    isPending: checkingSession,
    error: sessionError,
  } = authClient.useSession();

  const { data: events, isPending, error } = useScannerEvents();
  const visibleEvents =
    events?.filter((event) => !hasEventFinished(event.startsAt, now)) ?? [];

  if (checkingSession)
    return (
      <Page>
        <p role="status">Checking session...</p>
      </Page>
    );

  if (sessionError) {
    return (
      <Page>
        <p role="alert">Could not check your session.</p>
      </Page>
    );
  }

  if (!session) {
    return (
      <Page>
        <p>
          <LoginLink>Log in</LoginLink> to access check-in.
        </p>
      </Page>
    );
  }

  if (isPending)
    return (
      <Page>
        <p role="status">Loading events...</p>
      </Page>
    );
  if (error)
    return (
      <Page>
        <p role="alert">{error.message}</p>
      </Page>
    );

  return (
    <Page className="max-w-4xl">
      <header className="mb-6">
        <h1>Check-in dashboard</h1>
        <p className="text-muted">Choose an event to check in guests.</p>
      </header>

      {!visibleEvents.length ? (
        <Card>
          <p className="text-muted">
            No events available. Ask an organiser to grant you scan access.
          </p>
        </Card>
      ) : (
        visibleEvents.map((event) => (
          <Card as="article" className="my-4" key={event.id}>
            <h2 className="mb-1 text-lg">
              <Link
                to={`/scanner/events/${event.id}`}
                className="text-ink no-underline hover:underline"
              >
                {event.title}
              </Link>
            </h2>
            <p className="mb-0 text-sm text-muted">
              {new Date(event.startsAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>

            <div className="mt-5 flex flex-wrap justify-between gap-x-4 gap-y-1 border-y border-line py-3 text-sm">
              <span className="text-muted">Venue</span>
              <span className="min-w-0 wrap-anywhere">{event.venue}</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <LinkButton to={`/scanner/events/${event.id}`}>
                Open scanner
              </LinkButton>
            </div>
          </Card>
        ))
      )}
    </Page>
  );
}
