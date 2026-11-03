import { formatPrice } from "../../lib/format";
import EventPublicationControl from "../../features/events/components/EventPublicationControl";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Layout";
import { useNow } from "../../lib/useNow";
import { useWorkspaceEvent } from "../../app/useWorkspaceEvent";
import { useUpdateEventSettings } from "../../features/events/hooks";
import TicketTypeManagement from "../../features/tickets/components/TicketTypeManagement";
import CreateTicketTypeForm from "../../features/tickets/components/CreateTicketTypeForm";
import EventCapacityForm from "../../features/events/components/EventCapacityForm";
export default function EventTicketsPage() {
  const now = useNow();
  const event = useWorkspaceEvent();
  const mutation = useUpdateEventSettings(event.id);
  const locked =
    Boolean(event.cancelledAt) || new Date(event.startsAt).getTime() <= now;
  return (
    <section className="grid min-w-0 gap-6 [&>button]:justify-self-start">
      <EventPublicationControl event={event} />
      <div>
        <h2 className="mb-2">Tickets & sales</h2>
        <p className="text-muted">
          Manage pricing, sale windows and available places.
        </p>
      </div>
      <Card
        as="section"
        className="flex items-center justify-between gap-6 max-md:flex-col max-md:items-start [&_p]:text-sm [&_p]:text-muted [&_button]:shrink-0"
      >
        <div>
          <h3>
            {event.salesClosed
              ? "Sales paused"
              : event.publishedAt
                ? "Reservations open"
                : "Publish the event to open sales"}
          </h3>
          <p>
            Ticket sale dates still apply. Existing bookings stay unchanged.
          </p>
        </div>
        <Button
          disabled={locked || mutation.isPending}
          onClick={() =>
            mutation.mutate({ kind: "sales", salesClosed: !event.salesClosed })
          }
        >
          {mutation.isPending
            ? "Updating…"
            : event.salesClosed
              ? "Reopen sales"
              : "Pause sales"}
        </Button>
      </Card>
      <p className="text-sm text-muted">
        Sales must end by{" "}
        {new Date(event.cateringDeadline ?? event.startsAt).toLocaleString(
          "en-GB",
        )}
        {event.cateringDeadline ? " (catering deadline)" : " (event start)"}.
      </p>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
      {event.cancelledAt ? (
        <Card>
          <h3>Ticket types</h3>
          {event.ticketTypes.map((t) => (
            <p key={t.id}>
              {t.tier === "VIP" ? "VIP" : "Standard"} ·
              {formatPrice(t.pricePence)} · {t.capacity} places
            </p>
          ))}
        </Card>
      ) : (
        <>
          <Card>
            <TicketTypeManagement event={event} />
          </Card>
          {!locked && (
            <>
              <Modal title="Add a ticket type" triggerLabel="Add a ticket type">
                <CreateTicketTypeForm eventId={event.id} />
              </Modal>
              <Card>
                <EventCapacityForm
                  eventId={event.id}
                  capacity={event.capacity}
                />
              </Card>
            </>
          )}
        </>
      )}
    </section>
  );
}
