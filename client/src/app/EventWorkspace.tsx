import LoginLink from "../features/auth/components/LoginLink";
import { NavigationLink } from "../components/ui/NavigationLink";
import { LinkButton } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Page } from "../components/ui/Layout";
import { useNow } from "../lib/useNow";
import { Link, Outlet, useParams } from "react-router";
import { authClient } from "../lib/auth-client";
import { useEvent } from "../features/events/hooks";
import { useOrganisedSocieties } from "../features/societies/hooks";

export default function EventWorkspace() {
  const { eventId } = useParams();
  if (!eventId)
    return (
      <Page>
        <p role="alert">Missing event ID.</p>
      </Page>
    );
  return <Workspace key={eventId} eventId={eventId} />;
}
function Workspace({ eventId }: { eventId: string }) {
  const now = useNow();
  const session = authClient.useSession();
  const eventQuery = useEvent(eventId);
  const societies = useOrganisedSocieties();
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
        <h1>Organiser workspace</h1>
        <p>
          <LoginLink>Log in</LoginLink> to continue.
        </p>
      </Page>
    );
  if (eventQuery.isPending || societies.isPending)
    return (
      <Page>
        <p role="status">Loading your event…</p>
      </Page>
    );
  if (eventQuery.error || societies.error)
    return (
      <Page>
        <p role="alert">
          {eventQuery.error?.message ?? societies.error?.message}
        </p>
        <Link to="/organiser">Back to events</Link>
      </Page>
    );
  const event = eventQuery.data;
  if (!event || !societies.data?.some((s) => s.id === event.societyId))
    return (
      <Page>
        <h1>Organiser access required</h1>
        <p>You do not manage this event.</p>
        <Link to="/events">Browse events</Link>
      </Page>
    );
  const base = `/organiser/events/${eventId}`;
  const links = [
    ["", "Overview"],
    ["bookings", "Bookings"],
    ["tickets", "Tickets & sales"],
    ["guests", "Guests & catering"],
    ["seating", "Seating"],
    ["staff", "Staff"],
    ["settings", "Settings"],
  ];
  return (
    <Page wide>
      <Link className="text-sm no-underline" to="/organiser">
        ← All your events
      </Link>
      <header className="mb-8 flex items-center justify-between gap-6 border-b border-line pt-5 pb-6 max-md:flex-col max-md:items-start max-md:gap-4 max-md:pb-6">
        <div className="min-w-0">
          <h1>{event.title}</h1>
          <p className="mb-0 text-sm text-muted">
            {event.venue} ·{" "}
            {new Date(event.startsAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 max-md:justify-start">
          <Badge tone={event.cancelledAt ? "danger" : "neutral"}>
            {event.cancelledAt
              ? "Cancelled"
              : !event.publishedAt
                ? "Draft"
                : new Date(event.startsAt).getTime() <= now
                  ? "Event started"
                  : event.salesClosed
                    ? "Sales paused"
                    : "Active"}
          </Badge>
          <LinkButton to={`/events/${event.id}`}>
            {event.publishedAt ? "View public page" : "Preview draft"}
          </LinkButton>
        </div>
      </header>
      {event.cancelledAt && (
        <p className="rounded-md border border-amber-400/25 bg-amber-400/10 p-4 text-amber-200">
          This event is cancelled. Records remain available; event editing is
          closed.
        </p>
      )}
      <div className="grid grid-cols-[190px_minmax(0,1fr)] gap-10 max-lg:grid-cols-[160px_minmax(0,1fr)] max-lg:gap-6 max-md:grid-cols-1">
        <nav
          className="sticky top-4 flex flex-col gap-1 self-start max-md:static max-md:flex-row max-md:gap-1 max-md:overflow-x-auto max-md:pb-2"
          aria-label="Event management"
        >
          {links.map(([path, label]) => (
            <NavigationLink
              layout="sidebar"
              key={path}
              end={!path}
              to={path ? `${base}/${path}` : base}
            >
              {label}
            </NavigationLink>
          ))}
        </nav>
        <div
          className="min-w-0 [&>section>h2]:mb-0 [&>section>p]:mb-0 [&_section]:min-w-0"
          key={session.data.user.id}
        >
          <Outlet context={event} />
        </div>
      </div>
    </Page>
  );
}
