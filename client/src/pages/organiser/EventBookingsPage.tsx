import { formatPrice } from "../../lib/format";
import { TableScroll } from "../../components/ui/Layout";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useWorkspaceEvent } from "../../app/useWorkspaceEvent";
import RevokeTicketForm from "../../features/tickets/components/RevokeTicketForm";
import { useState } from "react";
import { useEventBookings } from "../../features/bookings/hooks";

export default function EventBookingsPage() {
  const { id: eventId } = useWorkspaceEvent();

  return <EventBookings key={eventId} eventId={eventId} />;
}

function EventBookings({ eventId }: { eventId: string }) {
  const event = useWorkspaceEvent();
  const [page, setPage] = useState(1);

  const { data, isPending, error, isFetching, refetch } = useEventBookings(
    eventId,
    page,
  );

  if (isPending) return <p>Loading bookings...</p>;

  if (error) {
    return (
      <section className="grid min-w-0 gap-6 [&>button]:justify-self-start">
        <p role="alert">{error.message}</p>
        <Button type="button" onClick={() => void refetch()}>
          Retry
        </Button>
      </section>
    );
  }

  return (
    <section className="grid min-w-0 gap-6 [&>button]:justify-self-start">
      <div>
        <h2 className="mb-2">Bookings</h2>
        <p className="text-muted">
          These records show buyers and reservation status.
        </p>
      </div>
      {!event.cancelledAt && (
        <Modal
          title="Block a ticket"
          triggerLabel="Block a ticket"
          variant="danger"
        >
          <RevokeTicketForm eventId={eventId} />
        </Modal>
      )}

      <Button
        variant="secondary"
        type="button"
        disabled={isFetching}
        onClick={() => void refetch()}
      >
        {isFetching ? "Refreshing..." : "Refresh"}
      </Button>

      {data.bookings.length === 0 ? (
        <p>No bookings on this page.</p>
      ) : (
        <TableScroll role="region" aria-label="Scrollable records" tabIndex={0}>
          <table>
            <caption>Bookings, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Buyer</th>
                <th scope="col">Ticket selection</th>
                <th scope="col">Booking total</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.bookings.map((booking) => (
                <tr key={booking.id}>
                  <th className="text-xs font-normal text-muted" scope="row">
                    {booking.id}
                  </th>
                  <td>
                    <div>{booking.user.name}</div>
                    <div className="text-muted">{booking.user.email}</div>
                  </td>
                  <td>
                    {booking.items.map((item) => (
                      <div key={item.id}>
                        {item.quantity} ×{" "}
                        {item.ticketType.tier === "STANDARD"
                          ? "Standard"
                          : "VIP"}
                      </div>
                    ))}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">
                    {formatPrice(booking.totalPence)}
                    {booking.simulatedPaymentAt && (
                      <div className="text-xs text-muted">Demo booking</div>
                    )}
                  </td>
                  <td>
                    <Badge
                      tone={
                        booking.status === "CONFIRMED"
                          ? "success"
                          : booking.status === "CANCELLED"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {booking.status.charAt(0) +
                        booking.status.slice(1).toLowerCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}

      <nav
        className="flex flex-wrap items-center gap-3"
        aria-label="Booking pages"
      >
        <Button
          variant="secondary"
          type="button"
          disabled={page === 1 || isFetching}
          onClick={() => setPage((current) => current - 1)}
        >
          Previous
        </Button>

        <span className="text-muted">Page {data.page}</span>

        <Button
          variant="secondary"
          type="button"
          disabled={!data.hasMore || isFetching}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </Button>
      </nav>
    </section>
  );
}
