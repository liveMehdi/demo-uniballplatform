import { Button } from "../../../components/ui/Button";
import { useBookingSeating } from "../hooks";

export default function BookingSeatingDetails({
  bookingId,
}: {
  bookingId: string;
}) {
  const { data, isPending, error, isFetching, refetch } =
    useBookingSeating(bookingId);

  return (
    <section aria-labelledby="booking-seating-heading">
      <h2 id="booking-seating-heading">Your seating</h2>

      <Button
        variant="secondary"
        type="button"
        disabled={isFetching}
        onClick={() => void refetch()}
      >
        {isFetching ? "Refreshing..." : "Refresh seating"}
      </Button>

      {isPending ? (
        <p>Loading seating...</p>
      ) : error ? (
        <p role="alert">{error.message}</p>
      ) : data?.visibility === "not_confirmed" ? (
        <p>Seating is shown for confirmed bookings.</p>
      ) : data?.visibility === "hidden" ? (
        <p>Seating hasn't been shared yet.</p>
      ) : data?.visibility === "published" ? (
        data.guests.length === 0 ? (
          <p>No guests found.</p>
        ) : (
          <ul>
            {data.guests.map((guest) => (
              <li key={guest.id}>
                <strong>{guest.fullName || `Guest ${guest.position}`}</strong>
                {" — "}
                {guest.tableName ?? "Not seated yet"}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
