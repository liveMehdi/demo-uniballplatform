import { useState } from "react";
import { Link } from "react-router";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Fields";
import { Card, Page } from "../../components/ui/Layout";
import { useNow } from "../../lib/useNow";
import { useEvents } from "../../features/events/hooks";

export default function EventsPage() {
  const now = useNow();
  const query = useEvents();
  const [search, setSearch] = useState("");

  const [showPast, setShowPast] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  const events = (query.data ?? []).filter(
    (event) =>
      (showPast || new Date(event.startsAt).getTime() > now) &&
      (showCancelled || !event.cancelledAt) &&
      `${event.title} ${event.venue}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  return (
    <Page>
      <header className="mb-8">
        <h1>Events</h1>
        <p className="text-muted">University balls and formal dinners.</p>
      </header>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-sm">
          <label htmlFor="event-search">Find an event</label>
          <Input
            id="event-search"
            type="search"
            placeholder="Event or venue"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="flex items-center gap-2 text-muted">
            <Input
              type="checkbox"
              checked={showPast}
              onChange={(event) => setShowPast(event.target.checked)}
            />
            Include past events
          </label>
          <label className="flex items-center gap-2 text-muted">
            <Input
              type="checkbox"
              checked={showCancelled}
              onChange={(event) => setShowCancelled(event.target.checked)}
            />
            Include cancelled events
          </label>
        </div>
      </div>

      {query.isPending ? (
        <p role="status">Loading events…</p>
      ) : query.error ? (
        <p role="alert">{query.error.message}</p>
      ) : events.length ? (
        <div className="divide-y divide-line border-y border-line">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-5 px-3 py-6 text-body no-underline transition-colors duration-150 hover:bg-surface hover:text-body max-sm:grid-cols-[48px_minmax(0,1fr)] max-sm:gap-3"
            >
              <div
                className="text-center"
                aria-label={new Date(event.startsAt).toLocaleDateString(
                  "en-GB",
                )}
              >
                <span className="block text-xs text-accent">
                  {new Date(event.startsAt).toLocaleDateString("en-GB", {
                    month: "short",
                  })}
                </span>
                <strong className="font-serif text-2xl font-medium text-ink tabular-nums">
                  {new Date(event.startsAt).getDate()}
                </strong>
              </div>
              <div className="min-w-0">
                <h2 className="mb-1 text-lg">{event.title}</h2>
                <p className="mb-2 text-sm text-muted">{event.venue}</p>
                {event.description && (
                  <p className="line-clamp-2 text-sm text-muted">
                    {event.description}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-4 max-sm:col-start-2 max-sm:flex-row max-sm:items-center max-sm:justify-between">
                <Badge tone={event.cancelledAt ? "danger" : "neutral"}>
                  {event.cancelledAt
                    ? "Cancelled"
                    : new Date(event.startsAt).getTime() <= now
                      ? "Past event"
                      : "Upcoming"}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="py-10 text-center">
          <h2>No events found</h2>
          <p className="text-muted">
            Try another search or include past or cancelled events.
          </p>
        </Card>
      )}
    </Page>
  );
}
