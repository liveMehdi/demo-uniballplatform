import { formatPrice } from "../../../lib/format";
import LoginLink from "../../auth/components/LoginLink";
import TicketOptions from "../../tickets/components/TicketOptions";
import { Button, LinkButton } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Fields";
import { useNow } from "../../../lib/useNow";
import { useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { authClient } from "../../../lib/auth-client";
import type { TicketTypeSummary } from "../../events/api";
import { useCreateBooking } from "../hooks";
import { BookingRequestError, type CreateBookingInput } from "../api";
import {
  readReservationAttempt,
  reservationStorageKey,
} from "../reservationAttempt";

type Props = {
  eventId: string;
  ticketTypes: TicketTypeSummary[];
  canReserve?: boolean;
};

export default function BookingForm({
  eventId,
  ticketTypes,
  canReserve = true,
}: Props) {
  const {
    data: session,
    isPending: checkingSession,
    error: sessionError,
  } = authClient.useSession();

  if (checkingSession) return <p>Checking session...</p>;

  if (sessionError) {
    return <p role="alert">Could not check your session.</p>;
  }

  if (!session) {
    return (
      <>
        {!!ticketTypes.length && <TicketOptions ticketTypes={ticketTypes} />}
        {canReserve && (
          <p className="mt-4">
            <LoginLink>Log in</LoginLink> to book tickets.
          </p>
        )}
      </>
    );
  }

  return (
    <ReservationForm
      key={session.user.id + ":" + eventId}
      userId={session.user.id}
      eventId={eventId}
      ticketTypes={ticketTypes}
      canReserve={canReserve}
    />
  );
}

function ReservationForm({
  userId,
  eventId,
  ticketTypes,
  canReserve,
}: Props & { userId: string }) {
  const now = useNow();
  const booking = useCreateBooking(eventId);
  const storageKey = reservationStorageKey(userId, eventId);
  const [recovery, setRecovery] = useState(() => {
    try {
      return {
        attempt: readReservationAttempt(sessionStorage, storageKey),
        error: "",
      };
    } catch {
      return {
        attempt: null,
        error:
          "Could not recover reservation requests in this tab. Check My bookings before trying again.",
      };
    }
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const submitting = useRef(false);

  function submit(input: CreateBookingInput) {
    if (submitting.current || booking.isSuccess) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(input));
    } catch {
      setValidationError(
        "Allow session storage before reserving so your request can be recovered safely.",
      );
      return;
    }
    setRecovery({ attempt: input, error: "" });
    submitting.current = true;
    booking.mutate(input, {
      onSuccess: () => clearAttempt(),
      onError: (error) => {
        if (error instanceof BookingRequestError && error.notCreated)
          clearAttempt();
      },
      onSettled: () => {
        submitting.current = false;
      },
    });
  }

  function clearAttempt() {
    try {
      sessionStorage.removeItem(storageKey);
      setRecovery({ attempt: null, error: "" });
    } catch {
      // Retain the recovery request if storage becomes unavailable.
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !canReserve ||
      recovery.attempt ||
      recovery.error ||
      submitting.current ||
      booking.isSuccess
    )
      return;
    const formData = new FormData(event.currentTarget);
    const items = ticketTypes
      .map((ticket) => ({
        ticketTypeId: ticket.id,
        quantity: Number(formData.get(ticket.id) ?? 0),
      }))
      .filter((item) => item.quantity > 0);
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    setValidationError(null);
    if (
      total < 1 ||
      total > 10 ||
      items.some((item) => !Number.isInteger(item.quantity))
    ) {
      setValidationError("Choose between 1 and 10 tickets.");
      return;
    }
    submit({ requestKey: crypto.randomUUID(), items });
  }

  if (booking.isSuccess) {
    const activeReservation =
      booking.data.status === "PENDING" &&
      new Date(booking.data.expiresAt).getTime() > now;
    return (
      <section aria-labelledby="booking-result-heading">
        <h2 id="booking-result-heading">Booking recorded</h2>
        <p>Reference: {booking.data.id}</p>
        <p>
          Status:{" "}
          {booking.data.status === "PENDING" && !activeReservation
            ? "Reservation ended"
            : booking.data.status}
        </p>
        <p>Ticket total: {formatPrice(booking.data.totalPence)}</p>
        <p>
          Reservation deadline:{" "}
          {new Date(booking.data.expiresAt).toLocaleString("en-GB")}
        </p>
        <p>
          {booking.data.totalPence === 0
            ? "Complete your guest details, then confirm this free booking."
            : "Complete your guest details, then use demo checkout."}
        </p>
        <div className="flex flex-wrap gap-3">
          {activeReservation && (
            <LinkButton to={`/bookings/${booking.data.id}/guests`}>
              Add guest details
            </LinkButton>
          )}
          <LinkButton variant="secondary" to="/bookings">
            View my bookings
          </LinkButton>
        </div>
      </section>
    );
  }

  if (recovery.error || recovery.attempt) {
    return (
      <section aria-labelledby="reservation-recovery-heading">
        <h2 id="reservation-recovery-heading">Check your reservation</h2>
        <p>
          {recovery.error ||
            "Check your previous reservation before booking again."}
        </p>
        <div className="flex flex-wrap gap-3">
          {recovery.attempt && (
            <Button
              disabled={booking.isPending}
              onClick={() => submit(recovery.attempt!)}
            >
              {booking.isPending ? "Checking..." : "Retry previous request"}
            </Button>
          )}
          <LinkButton variant="secondary" to="/bookings">
            View my bookings
          </LinkButton>
        </div>
        {validationError && <p role="alert">{validationError}</p>}
        {booking.error && <p role="alert">{booking.error.message}</p>}
      </section>
    );
  }
  if (!canReserve || !ticketTypes.length)
    return (
      <>
        {!!ticketTypes.length && <TicketOptions ticketTypes={ticketTypes} />}
        {booking.error && <p role="alert">{booking.error.message}</p>}
      </>
    );

  return (
    <section aria-labelledby="booking-heading">
      <h2 id="booking-heading" className="mb-1">
        Reserve tickets
      </h2>
      <p className="text-xs text-muted">Demo bookings only.</p>

      <form onSubmit={handleSubmit}>
        <fieldset className="mb-0" disabled={booking.isPending}>
          <legend className="sr-only">Ticket quantities</legend>
          {ticketTypes.map((ticket) => {
            const salesOpen =
              now >= new Date(ticket.salesStart).getTime() &&
              now < new Date(ticket.salesEnd).getTime();

            return (
              <div
                className="mb-0 grid grid-cols-[minmax(0,1fr)_76px] items-center gap-x-3 border-t border-line py-3"
                key={ticket.id}
              >
                <label className="mb-0" htmlFor={`quantity-${ticket.id}`}>
                  <span className="block text-ink">
                    {ticket.tier === "STANDARD" ? "Standard" : "VIP"}
                    <span className="sr-only"> quantity</span>
                  </span>
                  <span className="text-xs font-normal text-muted">
                    {formatPrice(ticket.pricePence)} each
                  </span>
                </label>

                <Input
                  id={`quantity-${ticket.id}`}
                  name={ticket.id}
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  defaultValue="0"
                  disabled={!salesOpen}
                  required
                  aria-describedby={
                    !salesOpen ? `sales-${ticket.id}` : undefined
                  }
                />

                {!salesOpen && (
                  <p
                    id={`sales-${ticket.id}`}
                    className="col-span-2 mt-1 mb-0 text-xs text-muted"
                  >
                    {now < new Date(ticket.salesStart).getTime()
                      ? `Opens ${new Date(ticket.salesStart).toLocaleString("en-GB")}`
                      : "Sales closed"}
                  </p>
                )}
              </div>
            );
          })}

          <p className="mb-3 border-t border-line pt-3 text-xs text-muted">
            Up to 10 tickets per hold. One active hold per event, for up to 30
            minutes or until reservations close.
          </p>

          <Button className="mt-0 w-full" type="submit">
            {booking.isPending ? "Reserving..." : "Reserve tickets"}
          </Button>
        </fieldset>

        {validationError && <p role="alert">{validationError}</p>}
        {booking.error && <p role="alert">{booking.error.message}</p>}
      </form>
    </section>
  );
}
