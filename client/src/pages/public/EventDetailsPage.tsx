import { Badge } from "../../components/ui/Badge";
import { LinkButton } from "../../components/ui/Button";
import { Card, Page } from "../../components/ui/Layout";
import { useNow } from "../../lib/useNow";
import { Link, useParams } from "react-router";
import { useEvent } from "../../features/events/hooks";
import { useOrganisedSocieties } from "../../features/societies/hooks";
import BookingForm from "../../features/bookings/components/BookingForm";
import { useState, type CSSProperties } from "react";
export default function EventDetailsPage() {
  const { eventId } = useParams();
  if (!eventId)
    return (
      <Page>
        <p role="alert">Missing event ID.</p>
      </Page>
    );
  return <EventDetails key={eventId} eventId={eventId} />;
}
function EventDetails({ eventId }: { eventId: string }) {
  const [failedBannerUrl, setFailedBannerUrl] = useState<string | null>(null);
  const now = useNow();
  const { data: event, isPending, error } = useEvent(eventId);

  const { data: societies } = useOrganisedSocieties();

  if (isPending)
    return (
      <Page>
        <p role="status">Loading event…</p>
      </Page>
    );

  if (error || !event)
    return (
      <Page>
        <p role="alert">{error?.message ?? "Event not found."}</p>
        <Link to="/events">Back to events</Link>
      </Page>
    );

  const organiser = societies?.some((s) => s.id === event.societyId);
  const reservationClosed =
    new Date(event.cateringDeadline ?? event.startsAt).getTime() <= now;
  const started = new Date(event.startsAt).getTime() <= now;
  return (
    <Page
      style={
        {
          "--event-heading": event.headingColor ?? "var(--color-ink)",
        } as CSSProperties
      }
      className="[&_h1]:text-[var(--event-heading)] [&_h2]:text-[var(--event-heading)] [&_h3]:text-[var(--event-heading)]"
    >
      <div className="mb-6 flex items-center justify-between gap-4 max-sm:flex-wrap max-sm:items-start">
        <Link className="text-sm no-underline" to="/events">
          ← Explore events
        </Link>
        {organiser && (
          <LinkButton to={`/organiser/events/${event.id}`}>
            Manage event
          </LinkButton>
        )}
      </div>
      {event.bannerUrl && event.bannerUrl !== failedBannerUrl && (
        <img
          src={event.bannerUrl}
          alt=""
          className="mb-6 aspect-[3/1] w-full rounded-md border border-line object-cover"
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => setFailedBannerUrl(event.bannerUrl)}
        />
      )}
      <header className="mb-8 border-b border-line pb-6">
        <h1>{event.title}</h1>
        {!event.publishedAt && (
          <p role="status">
            Draft preview ? only your society?s organisers can see this page.
          </p>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <span>
            {new Date(event.startsAt).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          <span>
            {new Date(event.startsAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span>{event.venue}</span>
        </div>
        {event.cancelledAt && (
          <Badge tone="danger" className="mt-4">
            Cancelled
          </Badge>
        )}
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_370px] items-start gap-8 max-lg:grid-cols-[minmax(0,1fr)_330px] max-lg:gap-5 max-md:grid-cols-1">
        <div className="grid min-w-0 gap-6 [&>button]:justify-self-start">
          <Card as="section">
            <h2>About this event</h2>
            <p className="whitespace-pre-wrap wrap-anywhere">
              {event.description ||
                "Further event details will be announced by the organiser."}
            </p>
          </Card>
          <Card as="section">
            <h2>Meal options</h2>
            {!event.cateringDeadline ? (
              <p>No meal is included with this event.</p>
            ) : event.mealOptions.length ? (
              <ul className="mb-4 list-none divide-y divide-line p-0 [&_li]:mt-0 [&_li]:py-3 [&_p]:text-muted">
                {event.mealOptions.map((meal) => (
                  <li key={meal.id}>
                    <h3>{meal.name}</h3>
                    {meal.description && <p>{meal.description}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Meal options will be announced here.</p>
            )}
            <p className="text-muted">
              Add your meal choice and guest requirements through your booking.
            </p>
          </Card>
        </div>
        <Card
          as="aside"
          className="sticky top-6 max-md:static max-md:row-start-1 [&_section]:m-0"
          aria-label="Ticket booking"
        >
          {event.cancelledAt ? (
            <>
              <h2>Event cancelled</h2>
              <p role="status">Reservations and admission are closed.</p>
            </>
          ) : !event.publishedAt ? (
            <>
              <h2>Draft event</h2>
              <p>Publish the event to open reservations.</p>
            </>
          ) : started || reservationClosed ? (
            <>
              <h2>Reservations closed</h2>
              <p>
                {started
                  ? "This event has already started."
                  : "The catering deadline has passed."}
              </p>
            </>
          ) : event.salesClosed ? (
            <>
              <h2>Sales paused</h2>
              <p role="status">The organiser has paused new reservations.</p>
            </>
          ) : !event.ticketTypes.length ? (
            <>
              <h2>Tickets coming soon</h2>
              <p>Ticket options have not been announced yet.</p>
            </>
          ) : null}

          <BookingForm
            eventId={event.id}
            ticketTypes={event.ticketTypes}
            canReserve={
              Boolean(event.publishedAt) &&
              !event.cancelledAt &&
              !reservationClosed &&
              !started &&
              !event.salesClosed &&
              event.ticketTypes.length > 0
            }
          />

          {event.cateringDeadline && (
            <p className="mt-4 text-sm text-muted">
              Reservations and catering choices close{" "}
              {new Date(event.cateringDeadline).toLocaleString("en-GB")}.
            </p>
          )}
        </Card>
      </div>
    </Page>
  );
}
