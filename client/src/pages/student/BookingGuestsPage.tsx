import BookingConfirmation from "../../features/bookings/components/BookingConfirmation";
import LoginLink from "../../features/auth/components/LoginLink";
import { Card, Page } from "../../components/ui/Layout";
import { Badge } from "../../components/ui/Badge";
import { Disclosure } from "../../components/ui/Disclosure";
import { useNow } from "../../lib/useNow";
import { Link, useParams } from "react-router";
import { authClient } from "../../lib/auth-client";
import { useBookingGuests } from "../../features/bookings/hooks";
import GuestDetailsForm from "../../features/bookings/components/GuestDetailsForm";
import GuestGroupControls from "../../features/seating/components/GuestGroupControls";
import BookingSeatingDetails from "../../features/seating/components/BookingSeatingDetails";

export default function BookingGuestsPage() {
  const { bookingId } = useParams();

  if (!bookingId)
    return (
      <Page>
        <p role="alert">Missing booking ID.</p>
      </Page>
    );

  return <BookingGuests key={bookingId} bookingId={bookingId} />;
}

function BookingGuests({ bookingId }: { bookingId: string }) {
  const now = useNow();
  const {
    data: session,
    isPending: checkingSession,
    error: sessionError,
  } = authClient.useSession();

  const { data, isPending, error } = useBookingGuests(bookingId);

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
          <LoginLink>Log in</LoginLink> to continue.
        </p>
      </Page>
    );
  }

  if (isPending)
    return (
      <Page>
        <p role="status">Loading guest details...</p>
      </Page>
    );

  if (error) {
    return (
      <Page>
        <p role="alert">{error.message}</p>
        <Link to="/bookings">Back to my bookings</Link>
      </Page>
    );
  }

  const canEdit =
    data.canEdit &&
    new Date(data.event.startsAt).getTime() > now &&
    (data.status === "CONFIRMED" ||
      (data.status === "PENDING" && new Date(data.expiresAt).getTime() > now));

  return (
    <Page className="max-w-4xl">
      <Link className="text-sm no-underline" to="/bookings">
        ← Back to my bookings
      </Link>

      <header className="mt-5 mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          <h1 className="mb-1">Guest details</h1>
          <p className="mb-0 font-serif text-muted wrap-anywhere">
            {data.event.title}
          </p>
        </div>
        <Badge
          tone={
            data.status === "CONFIRMED"
              ? "success"
              : data.status === "CANCELLED"
                ? "danger"
                : "neutral"
          }
        >
          {data.status.charAt(0) + data.status.slice(1).toLowerCase()}
        </Badge>
      </header>

      {data.event.cateringDeadline && (
        <p className="text-sm text-muted">
          Meal and dietary changes close at{" "}
          {new Date(data.event.cateringDeadline).toLocaleString("en-GB")}.
        </p>
      )}
      <BookingConfirmation
        booking={data}
        canConfirm={
          canEdit &&
          new Date(
            data.event.cateringDeadline ?? data.event.startsAt,
          ).getTime() > now
        }
      />
      {!canEdit && (
        <p className="text-sm text-muted">
          Guest details can no longer be changed.
        </p>
      )}
      <Card className="my-6 [&_button]:mb-3 [&_p:not([role])]:text-muted">
        <BookingSeatingDetails bookingId={bookingId} />
      </Card>

      <p className="text-sm text-muted">
        Request seats together by joining a group. Tables are assigned by the
        organiser.
      </p>
      {data.items.map((item) => (
        <section className="my-6" key={item.id}>
          <h2 className="text-lg">
            {item.ticketType.tier === "STANDARD"
              ? "Standard guests"
              : "VIP guests"}
          </h2>

          {item.guests.map((guest) => (
            <Disclosure
              className="my-3 p-5"
              key={`${session.user.id}-${guest.id}`}
            >
              <summary className="text-sm text-ink wrap-anywhere">
                <span className="mr-2 font-normal text-muted">
                  Guest {guest.position}
                </span>
                {guest.fullName || "Name not provided"}
                <span className="mt-1 block pl-4 text-sm font-normal text-muted">
                  {guest.mealOption?.name ?? "No meal selected"}
                  {" · "}
                  {guest.tableGroup?.name ?? "No group"}
                </span>
              </summary>

              <div className="grid gap-6 border-t border-line pt-5">
                <GuestDetailsForm
                  bookingId={bookingId}
                  guest={guest}
                  canEdit={canEdit}
                  canEditCatering={
                    canEdit &&
                    data.canEditCatering &&
                    (!data.event.cateringDeadline ||
                      new Date(data.event.cateringDeadline).getTime() > now)
                  }
                  mealRequired={Boolean(data.event.cateringDeadline)}
                  mealOptions={data.event.mealOptions}
                />

                <div className="border-t border-line pt-5 text-sm">
                  <GuestGroupControls
                    key={guest.tableGroup?.id ?? "no-group"}
                    guestId={guest.id}
                    group={guest.tableGroup}
                    canJoin={canEdit}
                    canLeave={new Date(data.event.startsAt).getTime() > now}
                  />
                </div>
              </div>
            </Disclosure>
          ))}
        </section>
      ))}
    </Page>
  );
}
