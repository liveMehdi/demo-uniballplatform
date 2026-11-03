import { formatPrice } from "../../lib/format";
import LoginLink from "../../features/auth/components/LoginLink";
import { Card, Page } from "../../components/ui/Layout";
import { useNow } from "../../lib/useNow";
import { Link } from "react-router";
import { authClient } from "../../lib/auth-client";
import { useMyBookings } from "../../features/bookings/hooks";
import CancelBookingButton from "../../features/bookings/components/CancelBookingButton";
import { Badge } from "../../components/ui/Badge";
import { LinkButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Fields";
import { useState } from "react";

export default function MyBookingsPage() {
  const now = useNow();
  const [showCancelled, setShowCancelled] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const {
    data: session,
    isPending: checkingSession,
    error: sessionError,
  } = authClient.useSession();

  const { data: bookings = [], isPending, error } = useMyBookings();
  const visibleBookings = bookings.filter((booking) => {
    const expired =
      booking.status === "EXPIRED" ||
      (booking.status === "PENDING" &&
        new Date(booking.expiresAt).getTime() <= now);
    return (
      (showCancelled || booking.status !== "CANCELLED") &&
      (showExpired || !expired)
    );
  });

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
        <h1>My bookings</h1>
        <p>
          <LoginLink>Log in</LoginLink> to view your bookings.
        </p>
      </Page>
    );
  }

  if (isPending)
    return (
      <Page>
        <p role="status">Loading bookings...</p>
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
        <h1>My bookings</h1>
        <p className="text-muted">
          Your reservations, tickets and guest details
        </p>
      </header>

      <div className="mb-6 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <label className="mb-0 flex items-center gap-2 text-muted">
            <Input
              type="checkbox"
              checked={showCancelled}
              onChange={(event) => setShowCancelled(event.target.checked)}
            />
            Include cancelled

          </label>

          <label className="mb-0 flex items-center gap-2 text-muted">
            <Input
              type="checkbox"
              checked={showExpired}
              onChange={(event) => setShowExpired(event.target.checked)}
            />

            Include expired
          </label>
        </div>

        <p className="mb-0 shrink-0 text-sm text-muted">
          Showing {visibleBookings.length} of {bookings.length} bookings
        </p>
      </div>

      {bookings.length === 0 ? (

        <Card>
          <h2>No bookings yet</h2>
          <p className="text-muted">
            <Link to="/events">Browse events</Link> to find your next evening
            out.
          </p>
        </Card>

      ) : visibleBookings.length === 0 ? (

        <Card>
          <h2>No bookings match these filters</h2>
          <p className="text-muted">
            Include cancelled or expired bookings to see more.
          </p>
        </Card>

      ) : (
        visibleBookings.map((booking) => (
          <Card as="article" className="my-4" key={booking.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                
                <h2 className="mb-1 text-lg">
                  <Link
                    to={`/events/${booking.event.id}`}
                    className="text-ink no-underline hover:underline"
                  >
                    {booking.event.title}
                  </Link>
                </h2>

                <p className="mb-0 text-sm text-muted">
                  {new Date(booking.event.startsAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>

              <Badge
                className="shrink-0"
                tone={
                  booking.status === "CONFIRMED"
                    ? "success"
                    : booking.status === "CANCELLED"
                      ? "danger"
                      : "neutral"
                }
              >
                {booking.status === "PENDING" &&
                new Date(booking.expiresAt).getTime() <= now
                  ? "Reservation ended"
                  : booking.status.charAt(0) +
                    booking.status.slice(1).toLowerCase()}
              </Badge>
            </div>

            {booking.status === "PENDING" && (
              <p className="mt-4 mb-0 text-sm text-muted">
                {new Date(booking.expiresAt).getTime() > now ? (
                  <>
                    Reserved until{" "}
                    <time dateTime={booking.expiresAt}>
                      {new Date(booking.expiresAt).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                    {" · "}
                    {Math.ceil(
                      (new Date(booking.expiresAt).getTime() - now) / 60_000,
                    )}{" "}
                    min remaining. These places are not confirmed.
                  </>
                ) : (
                  "Reservation expired."
                )}
              </p>
            )}

            <ul className="mt-5 list-none divide-y divide-line border-t border-line pl-0">
              {booking.items.map((item) => (
                <li
                  key={item.id}
                  className="mt-0 flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 text-sm"
                >
                  <span>
                    {item.quantity} ×{" "}
                    {item.ticketType.tier === "STANDARD" ? "Standard" : "VIP"}
                  </span>

                  <span className="text-muted tabular-nums">
                    {formatPrice(item.unitPricePence)} each
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <span className="min-w-0 break-all text-xs text-muted">
                Ref: {booking.id}
              </span>

              <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                Total: {formatPrice(booking.totalPence)}
              </span>
            </div>

            {booking.simulatedPaymentAt && (
              <p className="mt-3 mb-0 text-sm text-muted">Demo booking</p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {booking.status === "CONFIRMED" && (
                <LinkButton to={`/bookings/${booking.id}/tickets`}>
                  View tickets
                </LinkButton>
              )}

              <LinkButton
                to={`/bookings/${booking.id}/guests`}
                variant="secondary"
              >
                {(booking.status === "CONFIRMED" ||
                  (booking.status === "PENDING" &&
                    new Date(booking.expiresAt).getTime() > now)) &&
                new Date(booking.event.startsAt).getTime() > now
                  ? "Manage guests"
                  : "View guest details"}
              </LinkButton>

              {booking.status === "PENDING" &&
                new Date(booking.expiresAt).getTime() > now && (
                  <CancelBookingButton bookingId={booking.id} />
                )}
            </div>
          </Card>
        ))
      )}
    </Page>
  );
}
