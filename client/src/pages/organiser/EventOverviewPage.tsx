import EventPublicationControl from "../../features/events/components/EventPublicationControl";
import { Card } from "../../components/ui/Layout";
import { Link } from "react-router";
import { useWorkspaceEvent } from "../../app/useWorkspaceEvent";
import { useOrganiserEvents } from "../../features/events/hooks";
import AttendanceSummary from "../../features/scanner/components/AttendanceSummary";
export default function EventOverviewPage() {
  const event = useWorkspaceEvent();
  const query = useOrganiserEvents();
  const summary = query.data?.find((item) => item.id === event.id);
  return (
    <section className="grid min-w-0 gap-6 [&>button]:justify-self-start">
      <EventPublicationControl event={event} />
      <div>
        <h2 className="mb-2">Event overview</h2>
        <p className="text-muted">Reservations and attendance.</p>
      </div>
      {query.error && <p role="alert">{query.error.message}</p>}
      <div className="grid grid-cols-3 gap-4 max-sm:gap-2">
        {[
          ["Pending places", summary?.pendingPlaces],
          ["Confirmed places", summary?.confirmedPlaces],
          [
            "Remaining places",
            event.cancelledAt ? "—" : (summary?.remainingPlaces ?? "Not set"),
          ],
        ].map(([label, value]) => (
          <Card className="max-sm:p-3" key={String(label)}>
            <span className="block text-xs text-muted">{label}</span>
            <strong className="mt-1 block text-2xl font-medium text-ink tabular-nums">
              {query.isPending ? "…" : (value ?? "—")}
            </strong>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1">
        <Card as="section">
          <h3>Event details</h3>
          <dl>
            <dt>Venue</dt>
            <dd>{event.venue}</dd>
            <dt>Starts</dt>
            <dd>{new Date(event.startsAt).toLocaleString("en-GB")}</dd>
            <dt>Total capacity</dt>
            <dd>{event.capacity ?? "Not set"}</dd>
          </dl>
          <Link to={`/organiser/events/${event.id}/settings`}>
            Edit details
          </Link>
        </Card>
        <Card as="section">
          <h3>Event tools</h3>
          <div className="grid gap-4 [&>a]:border-b [&>a]:border-line [&>a]:pb-3 [&>a]:no-underline">
            <Link to={`/organiser/events/${event.id}/bookings`}>Bookings</Link>
            <Link to={`/organiser/events/${event.id}/seating`}>Seating</Link>
            <Link to={`/organiser/events/${event.id}/guests`}>
              Guests & catering
            </Link>
            {!event.cancelledAt && event.publishedAt && (
              <Link to={`/scanner/events/${event.id}`}>Check-in</Link>
            )}
          </div>
        </Card>
      </div>
      {!event.cancelledAt && event.publishedAt && (
        <Card>
          <AttendanceSummary eventId={event.id} />
        </Card>
      )}
    </section>
  );
}
