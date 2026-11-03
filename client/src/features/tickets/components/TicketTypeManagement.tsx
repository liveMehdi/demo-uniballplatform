import { formatPrice, toLocalDateTime } from "../../../lib/format";
import { useEvent } from "../../events/hooks";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Fields";
import { useNow } from "../../../lib/useNow";
import { useState } from "react";
import type { SubmitEvent } from "react";
import type { EventDetails } from "../../events/api";
import { useManageEventTicket } from "../hooks";

type TicketType = EventDetails["ticketTypes"][number];

export default function TicketTypeManagement({
  event,
}: {
  event: EventDetails;
}) {
  const now = useNow();
  const canEdit = new Date(event.startsAt).getTime() > now;

  return (
    <section aria-labelledby="ticket-type-management-heading">
      <h2 id="ticket-type-management-heading">Manage ticket types</h2>

      <p className="text-muted">Price changes apply to new bookings only.</p>

      {event.ticketTypes.map((ticketType) => (
        <TicketTypeEditor
          key={ticketType.id}
          eventId={event.id}
          ticketType={ticketType}
          canEdit={canEdit}
        />
      ))}

      {event.ticketTypes.length === 0 && <p>Create a ticket type first.</p>}
    </section>
  );
}

function TicketTypeEditor({
  eventId,
  ticketType,
  canEdit,
}: {
  eventId: string;
  ticketType: TicketType;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<TicketType | null>(null);
  const query = useEvent(eventId);
  const mutation = useManageEventTicket(eventId);
  const prefix = `ticket-type-${ticketType.id}`;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !canEdit || mutation.isPending) return;

    const form = new FormData(event.currentTarget);
    const start = String(form.get("salesStart"));
    const end = String(form.get("salesEnd"));

    mutation.mutate(
      {
        kind: "update",
        ticketTypeId: ticketType.id,
        input: {
          expectedUpdatedAt: editing.updatedAt,
          pricePence: Number(form.get("pricePence")),
          capacity: Number(form.get("capacity")),
          salesStart: start === toLocalDateTime(editing.salesStart) ? editing.salesStart : new Date(start).toISOString(),
          salesEnd: end === toLocalDateTime(editing.salesEnd) ? editing.salesEnd : new Date(end).toISOString(),
        },
      },
      { onSuccess: () => setEditing(null) },
    );
  }

  return (
    <article className="mt-5 border-t border-line pt-5">
      <h3>{ticketType.tier === "VIP" ? "VIP" : "Standard"}</h3>

      <p>
        {formatPrice(ticketType.pricePence)}
        {" · "}Tickets: {ticketType.capacity}
      </p>

      {editing ? (
        <form key={editing.updatedAt} onSubmit={handleSubmit}>
          <fieldset disabled={!canEdit || mutation.isPending}>
            <legend>Edit ticket type</legend>

            <div className="mb-4">
              <label htmlFor={`${prefix}-price`}>Price in pence</label>
              <Input
                id={`${prefix}-price`}
                name="pricePence"
                type="number"
                min={0}
                max={2147483647}
                step={1}
                defaultValue={editing.pricePence}
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor={`${prefix}-capacity`}>Number of tickets</label>
              <Input
                id={`${prefix}-capacity`}
                name="capacity"
                type="number"
                min={1}
                max={2147483647}
                step={1}
                defaultValue={editing.capacity}
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor={`${prefix}-start`}>Sales start <span className="text-xs text-muted">Local time</span></label>
              <Input
                id={`${prefix}-start`}
                name="salesStart"
                type="datetime-local"
                defaultValue={toLocalDateTime(editing.salesStart)}
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor={`${prefix}-end`}>Sales end <span className="text-xs text-muted">Local time</span></label>
              <Input
                id={`${prefix}-end`}
                name="salesEnd"
                type="datetime-local"
                defaultValue={toLocalDateTime(editing.salesEnd)}
                required
              />
            </div>

            <Button className="mt-2.5" type="submit">
              Save ticket type
            </Button>
          </fieldset>

          <Button
            variant="secondary"
            className="mt-2.5"
            type="button"
            disabled={mutation.isPending}
            onClick={() => {
              setEditing(null);
              mutation.reset();
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="secondary"
          type="button"
          disabled={!canEdit || mutation.isPending}
          onClick={() => {
            mutation.reset();
            setEditing(ticketType);
          }}
        >
          Edit
        </Button>
      )}

      {mutation.isPending && <p role="status">Saving...</p>}
      {mutation.error && <>
        <p role="alert">{mutation.error.message}</p>
        {editing && <Button variant="secondary" type="button" disabled={query.isFetching} onClick={async () => {
          const latest = await query.refetch();
          const current = latest.data?.ticketTypes.find(item => item.id === ticketType.id);
          if (current && !latest.error) { setEditing(current); mutation.reset(); }
        }}>Discard edits and reload</Button>}
      </>}
      {mutation.isSuccess && <p role="status">Ticket type updated.</p>}
    </article>
  );
}
