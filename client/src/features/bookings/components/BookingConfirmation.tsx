import { formatPrice } from "../../../lib/format";
import { Button, LinkButton } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Layout";
import type { BookingGuestDetails } from "../api";
import { useConfirmBooking } from "../hooks";

export default function BookingConfirmation({
  booking,
  canConfirm,
}: {
  booking: BookingGuestDetails;
  canConfirm: boolean;
}) {
  const isDemoCheckout = booking.totalPence > 0;
  const mutation = useConfirmBooking(
    booking.id,
    isDemoCheckout ? "simulated" : "free",
  );

  if (booking.status === "CONFIRMED")
    return (
      <div>
        {booking.simulatedPaymentAt && (
          <p className="text-sm text-muted">Demo booking confirmed.</p>
        )}
        <LinkButton to={`/bookings/${booking.id}/tickets`}>
          View tickets
        </LinkButton>
      </div>
    );
  if (booking.status !== "PENDING" || !canConfirm) return null;

  const complete =
    booking.items.length > 0 &&
    booking.items.every(
      (item) =>
        item.guests.length === item.quantity &&
        item.guests.every(
          (guest) =>
            guest.fullName?.trim() &&
            (!booking.event.cateringDeadline || guest.mealOptionId),
        ),
    );

  return (
    <Card className="my-5">
      <h2>{isDemoCheckout ? "Demo checkout" : "Complete your booking"}</h2>
      <ul className="list-none divide-y divide-line pl-0">
        {booking.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap justify-between gap-2 py-2 text-sm"
          >
            <span>
              {item.quantity} &times;{" "}
              {item.ticketType.tier === "STANDARD" ? "Standard" : "VIP"}
            </span>
            <span className="tabular-nums">
              {formatPrice(item.quantity * item.unitPricePence)}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap justify-between gap-2 border-t border-line pt-3 text-sm font-semibold text-ink">
        <span>{isDemoCheckout ? "Simulated total" : "Total"}</span>
        <span className="tabular-nums">{formatPrice(booking.totalPence)}</span>
      </p>
      {!complete && (
        <p className="text-sm text-muted">
          Add all guest names
          {booking.event.cateringDeadline ? " and meal choices" : ""} to
          continue.
        </p>
      )}
      <Button
        disabled={!complete || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending
          ? "Confirming..."
          : isDemoCheckout
            ? "Complete demo booking"
            : "Confirm free booking"}
      </Button>
      {mutation.error && (
        <p role="alert">
          {mutation.error.message} Retrying won’t create a duplicate booking.
        </p>
      )}
    </Card>
  );
}
