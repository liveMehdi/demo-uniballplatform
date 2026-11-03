import { hasEventFinished } from "../../lib/eventLifecycle";
import LoginLink from "../../features/auth/components/LoginLink";
import { Badge } from "../../components/ui/Badge";
import { Button, LinkButton } from "../../components/ui/Button";
import { Card, Page } from "../../components/ui/Layout";
import { Input } from "../../components/ui/Fields";
import { useNow } from "../../lib/useNow";
import { Link } from "react-router";
import { authClient } from "../../lib/auth-client";
import { useOrganiserEvents } from "../../features/events/hooks";
import OrganiserAccessManager from "../../features/societies/components/OrganiserAccessManager";
import { useState } from "react";

export default function OrganiserDashboardPage() {
  const now = useNow();
  const [showCancelled, setShowCancelled] = useState(false);
  const [showFinished, setShowFinished] = useState(false);
  const session = authClient.useSession();
  const query = useOrganiserEvents();
  const events = query.data ?? [];
  const visibleEvents = events.filter((event) => {
    if (event.cancelledAt) return showCancelled;
    return showFinished || !hasEventFinished(event.startsAt, now);
  });
  if (session.isPending)
    return (
      <Page>
        <p role="status">Checking session…</p>
      </Page>
    );
  if (session.error)
    return (
      <Page>
        <p role="alert">Could not check your session.</p>
      </Page>
    );
  if (!session.data)
    return (
      <Page>
        <h1>Your events</h1>
        <p>
          <LoginLink>Log in</LoginLink> to continue.
        </p>
      </Page>
    );
  return (
    <Page>
      <header className="mb-6 flex items-center justify-between gap-4 max-sm:flex-wrap max-sm:items-start [&_p]:mb-0">
        <div>
          <h1>Your events</h1>
          <p className="text-muted">Manage your events</p>
        </div>
        <LinkButton variant="primary" to="/organiser/events/new">
          Create event
        </LinkButton>
      </header>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-muted">
          <Input
            type="checkbox"
            checked={showCancelled}
            onChange={(event) => setShowCancelled(event.target.checked)}
          />
          Include cancelled
        </label>
        <label className="flex items-center gap-2 text-muted">
          <Input
            type="checkbox"
            checked={showFinished}
            onChange={(event) => setShowFinished(event.target.checked)}
          />
          Include finished
        </label>
      </div>
      <div className="mb-6 flex items-center justify-between gap-4 max-sm:flex-wrap max-sm:items-start">
        <p className="mb-0 text-muted">
          Showing {visibleEvents.length} of {events.length} events
        </p>
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.isPending ? (
        <p role="status">Loading your events…</p>
      ) : !query.error && !query.data?.length ? (
        <Card className="border-dashed border-line px-6 py-12 text-center">
          <h2>No events yet</h2>
          <p>Create an event for a society you organise.</p>
        </Card>
      ) : !query.error && visibleEvents.length === 0 ? (
        <Card className="border-dashed border-line px-6 py-12 text-center">
          <h2>No events match these filters</h2>
          <p>Include cancelled or finished events to see more.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {visibleEvents.map((event) => (
            <Card
              as="article"
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-6 max-lg:grid-cols-[minmax(0,1fr)_auto] max-sm:grid-cols-1 [&_h2]:mt-3 [&_h2]:mb-2 [&_h2_a]:no-underline [&_p]:m-0"
              key={event.id}
            >
              <div>
                <Badge tone={event.cancelledAt ? "danger" : "neutral"}>
                  {event.cancelledAt
                    ? "Cancelled"
                    : !event.publishedAt
                      ? "Draft"
                      : hasEventFinished(event.startsAt, now)
                        ? "Finished"
                        : new Date(event.startsAt).getTime() <= now
                          ? "Event started"
                          : "Upcoming"}
                </Badge>
                <h2>
                  <Link to={`/organiser/events/${event.id}`}>
                    {event.title}
                  </Link>
                </h2>
                <p className="text-muted">
                  {event.societyName} ·{" "}
                  {new Date(event.startsAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <dl className="m-0 flex gap-8 max-sm:gap-6 [&_dd]:text-2xl [&_dd]:font-semibold [&_dd]:text-ink">
                <div>
                  <dt>Confirmed</dt>
                  <dd>{event.confirmedPlaces}</dd>
                </div>
                <div>
                  <dt>Pending</dt>
                  <dd>{event.pendingPlaces}</dd>
                </div>
                <div>
                  <dt>Remaining</dt>
                  <dd>
                    {event.cancelledAt ? "—" : (event.remainingPlaces ?? "—")}
                  </dd>
                </div>
              </dl>
              <LinkButton
                className="max-lg:col-span-full max-lg:justify-self-start"
                to={`/organiser/events/${event.id}`}
              >
                Manage event
              </LinkButton>
            </Card>
          ))}
        </div>
      )}
      <OrganiserAccessManager />
    </Page>
  );
}
