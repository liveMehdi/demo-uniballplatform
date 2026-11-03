import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Fields";
import { useState } from "react";
import type { SubmitEvent } from "react";
import type { EventTableSummary, SeatingGuest } from "../api";
import { useAssignGroupTable } from "../hooks";

type Props = {
  eventId: string;
  tables: EventTableSummary[];
  guests: SeatingGuest[];
  canEdit: boolean;
};

type SeatingGroup = {
  id: string;
  name: string;
  guests: SeatingGuest[];
};

export default function GroupSeatingControls({
  eventId,
  tables,
  guests,
  canEdit,
}: Props) {
  const groups = new Map<string, SeatingGroup>();

  for (const guest of guests) {
    if (!guest.tableGroup) continue;

    let group = groups.get(guest.tableGroup.id);

    if (!group) {
      group = {
        id: guest.tableGroup.id,
        name: guest.tableGroup.name,
        guests: [],
      };

      groups.set(group.id, group);
    }

    group.guests.push(guest);
  }

  const sortedGroups = [...groups.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <section aria-labelledby="group-seating-heading">
      <h2 id="group-seating-heading">Seat groups together</h2>

      <p>Guests who join later need seating separately.</p>

      {sortedGroups.length === 0 ? (
        <p>No groups to seat yet.</p>
      ) : (
        sortedGroups.map((group) => (
          <GroupAssignmentForm
            key={group.id}
            eventId={eventId}
            group={group}
            tables={tables}
            canEdit={canEdit}
          />
        ))
      )}
    </section>
  );
}

function GroupAssignmentForm({
  eventId,
  group,
  tables,
  canEdit,
}: {
  eventId: string;
  group: SeatingGroup;
  tables: EventTableSummary[];
  canEdit: boolean;
}) {
  const mutation = useAssignGroupTable(eventId);
  const [destination, setDestination] = useState("");

  const assignedTableIds = new Set(
    group.guests
      .map((guest) => guest.assignedTableId)
      .filter((id): id is string => id !== null),
  );

  const unassignedCount = group.guests.filter(
    (guest) => guest.assignedTableId === null,
  ).length;

  const currentTables = tables
    .filter((table) => assignedTableIds.has(table.id))
    .map((table) => table.name);

  function canFit(table: EventTableSummary) {
    const groupAlreadyHere = group.guests.filter(
      (guest) => guest.assignedTableId === table.id,
    ).length;

    const otherOccupants = table.occupiedSeats - groupAlreadyHere;

    return otherOccupants + group.guests.length <= table.capacity;
  }

  const selectedTable = tables.find((table) => table.id === destination);

  const validDestination =
    destination === "unassigned" ||
    (selectedTable !== undefined && canFit(selectedTable));

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit || mutation.isPending || !validDestination) return;

    mutation.mutate(
      {
        groupId: group.id,
        tableId: destination === "unassigned" ? null : destination,
      },
      {
        onSuccess: () => setDestination(""),
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 rounded-md border border-line p-4"
    >
      <h3>{group.name}</h3>

      <p className="text-sm">
        {group.guests.length} guests. Still need a table: {unassignedCount}.
      </p>

      <p className="text-sm">
        Current tables:{" "}
        {currentTables.length > 0 ? currentTables.join(", ") : "None"}.
      </p>

      <fieldset disabled={!canEdit || mutation.isPending}>
        <legend>Group destination</legend>

        <label htmlFor={`group-destination-${group.id}`}>
          Move the whole group to
        </label>

        <Select
          id={`group-destination-${group.id}`}
          value={destination}
          onChange={(event) => {
            setDestination(event.target.value);
            mutation.reset();
          }}
        >
          <option value="" disabled>
            Choose a destination
          </option>

          <option value="unassigned">Not seated yet</option>

          {tables.map((table) => {
            const fits = canFit(table);

            return (
              <option key={table.id} value={table.id} disabled={!fits}>
                {table.name}
                {fits ? "" : " — not enough space"}
              </option>
            );
          })}
        </Select>

        <Button className="mt-2.5" type="submit" disabled={!validDestination}>
          {mutation.isPending ? "Saving..." : "Apply to group"}
        </Button>
      </fieldset>

      {mutation.error && <p role="alert">{mutation.error.message}</p>}

      {mutation.isSuccess && <p role="status">Group seating updated.</p>}
    </form>
  );
}
