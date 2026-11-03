import { useWorkspaceEvent } from "../../app/useWorkspaceEvent";
import { hasEventFinished } from "../../lib/eventLifecycle";
import { Input, Select } from "../../components/ui/Fields";
import { Card, TableScroll } from "../../components/ui/Layout";
import { Button } from "../../components/ui/Button";
import { useNow } from "../../lib/useNow";
import { useState, type SubmitEvent } from "react";
import SeatingWarnings from "../../features/seating/components/SeatingWarnings";
import SeatingBoard from "../../features/seating/components/SeatingBoard";
import {
  useAssignGuestTable,
  useCreateEventTable,
  useEventSeating,
} from "../../features/seating/hooks";
import type {
  EventTableSummary,
  SeatingGuest,
} from "../../features/seating/api";
import GroupSeatingControls from "../../features/seating/components/GroupSeatingControls";
import TableManagement from "../../features/seating/components/TableManagement";
import SeatingPublicationControls from "../../features/seating/components/SeatingPublicationControls";

const seatingViews = [
  { id: "board", label: "Board" },
  { id: "tables", label: "Tables" },
  { id: "groups", label: "Groups" },
  { id: "guests", label: "Guest list" },
] as const;

export default function EventSeatingPage() {
  const { id: eventId } = useWorkspaceEvent();

  return <EventSeating key={eventId} eventId={eventId} />;
}

function EventSeating({ eventId }: { eventId: string }) {
  const [view, setView] =
    useState<(typeof seatingViews)[number]["id"]>("board");
  const now = useNow();
  const { data, isPending, error, isFetching, refetch } =
    useEventSeating(eventId);

  if (isPending) return <p>Loading seating...</p>;

  if (error) return <p role="alert">{error.message}</p>;

  if (!data) return null;

  const active =
    !data.event.cancelledAt && !hasEventFinished(data.event.startsAt, now);
  const canEdit = active && !data.event.seatingPublishedAt;
  const canCreate = canEdit && new Date(data.event.startsAt).getTime() > now;

  const unassignedCount = data.guests.filter(
    (guest) => guest.assignedTableId === null,
  ).length;

  return (
    <section className="grid min-w-0 gap-6 [&>button]:justify-self-start">
      <h2>Seating</h2>

      {!data.event.cancelledAt && (
        <Card>
          <SeatingPublicationControls
            eventId={eventId}
            publishedAt={data.event.seatingPublishedAt}
            canChange={active}
          />
        </Card>
      )}

      <Button
        variant="secondary"
        type="button"
        disabled={isFetching}
        onClick={() => void refetch()}
      >
        {isFetching ? "Refreshing..." : "Refresh"}
      </Button>

      {!active && (
        <p>
          {data.event.cancelledAt
            ? "This event was cancelled. Seating can't be changed."
            : "This event has finished. Seating can't be changed."}
        </p>
      )}

      <Card>
        <SeatingWarnings tables={data.tables} guests={data.guests} />
      </Card>
      <div
        role="group"
        aria-label="Seating view"
        className="flex flex-wrap gap-2 border-b border-line pb-4"
      >
        {seatingViews.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={view === option.id ? "primary" : "secondary"}
            aria-pressed={view === option.id}
            aria-controls={`seating-${option.id}`}
            onClick={() => setView(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div id="seating-tables" hidden={view !== "tables"}>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <TableManagement
              eventId={eventId}
              tables={data.tables}
              canEdit={canEdit}
            />
          </Card>
          {canCreate && (
            <Card>
              <CreateTableForm eventId={eventId} />
            </Card>
          )}
        </div>
      </div>
      <div id="seating-groups" hidden={view !== "groups"}>
        <Card>
          <GroupSeatingControls
            eventId={eventId}
            tables={data.tables}
            guests={data.guests}
            canEdit={canEdit}
          />
        </Card>
      </div>
      <div id="seating-board" hidden={view !== "board"}>
        <SeatingBoard
          eventId={eventId}
          tables={data.tables}
          guests={data.guests}
          canEdit={canEdit}
        />
      </div>

      <div id="seating-guests" hidden={view !== "guests"}>
        <Card as="section" aria-labelledby="assignments-heading">
          <h2 id="assignments-heading">Guest seating</h2>

          <p>
            Guests: {data.guests.length}. Still need a table: {unassignedCount}.
          </p>

          <p>
            Seating groups show requests to sit together. Assigning a guest
            moves only that guest.
          </p>

          {data.guests.length === 0 ? (
            <p>No guests to seat yet.</p>
          ) : (
            <TableScroll
              role="region"
              aria-label="Scrollable records"
              tabIndex={0}
            >
              <table>
                <caption>Guest seating</caption>

                <thead>
                  <tr>
                    <th scope="col">Guest</th>
                    <th scope="col">Tier</th>
                    <th scope="col">Booking status</th>
                    <th scope="col">Seating group</th>
                    <th scope="col">Table</th>
                  </tr>
                </thead>

                <tbody>
                  {data.guests.map((guest) => (
                    <tr key={guest.id}>
                      <th scope="row">
                        {guest.fullName || `Unnamed guest ${guest.position}`}
                        <small className="block font-normal text-muted">
                          Booking: {guest.bookingId}
                        </small>
                      </th>

                      <td>{guest.tier === "VIP" ? "VIP" : "Standard"}</td>

                      <td>
                        {guest.bookingStatus === "CONFIRMED"
                          ? "Confirmed"
                          : "Pending"}
                      </td>

                      <td>{guest.tableGroup?.name ?? "No group"}</td>

                      <td>
                        <GuestTableSelect
                          eventId={eventId}
                          guest={guest}
                          tables={data.tables}
                          canEdit={canEdit}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Card>
      </div>
    </section>
  );
}

function CreateTableForm({ eventId }: { eventId: string }) {
  const mutation = useCreateEventTable(eventId);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mutation.isPending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    mutation.mutate(
      {
        name: String(formData.get("name") ?? "").trim(),
        capacity: Number(formData.get("capacity")),
      },
      {
        onSuccess: () => form.reset(),
      },
    );
  }

  return (
    <section aria-labelledby="create-table-heading">
      <h2 id="create-table-heading">Create a table</h2>

      <form onSubmit={handleSubmit} onChange={() => mutation.reset()}>
        <fieldset disabled={mutation.isPending}>
          <legend>Table details</legend>

          <div className="mb-4">
            <label htmlFor="table-name">Name</label>
            <Input
              id="table-name"
              name="name"
              required
              maxLength={80}
              placeholder="Table 1"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="table-capacity">Seats</label>
            <Input
              id="table-capacity"
              name="capacity"
              type="number"
              min={1}
              max={2147483647}
              step={1}
              defaultValue={10}
              required
            />
          </div>

          <Button className="mt-2.5" type="submit">
            {mutation.isPending ? "Creating..." : "Create table"}
          </Button>
        </fieldset>

        {mutation.error && <p role="alert">{mutation.error.message}</p>}

        {mutation.isSuccess && <p role="status">Table created.</p>}
      </form>
    </section>
  );
}

function GuestTableSelect({
  eventId,
  guest,
  tables,
  canEdit,
}: {
  eventId: string;
  guest: SeatingGuest;
  tables: EventTableSummary[];
  canEdit: boolean;
}) {
  const mutation = useAssignGuestTable(eventId);

  return (
    <div>
      <label htmlFor={`guest-table-${guest.id}`}>
        Table for {guest.fullName || `guest ${guest.position}`}
      </label>

      <Select
        id={`guest-table-${guest.id}`}
        value={guest.assignedTableId ?? ""}
        disabled={!canEdit || mutation.isPending}
        onChange={(event) => {
          mutation.mutate({
            guestId: guest.id,
            tableId: event.target.value || null,
          });
        }}
      >
        <option value="">Not seated yet</option>

        {tables.map((table) => {
          const isCurrentTable = guest.assignedTableId === table.id;
          const isFull = table.occupiedSeats >= table.capacity;

          return (
            <option
              key={table.id}
              value={table.id}
              disabled={isFull && !isCurrentTable}
            >
              {table.name} ({table.occupiedSeats}/{table.capacity})
            </option>
          );
        })}
      </Select>

      {mutation.isPending && <p role="status">Saving...</p>}

      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </div>
  );
}
