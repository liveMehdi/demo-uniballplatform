import type { EventTableSummary, SeatingGuest } from "../api";

type Props = {
  tables: EventTableSummary[];
  guests: SeatingGuest[];
};

type GroupSummary = {
  id: string;
  name: string;
  guestCount: number;
  unassignedCount: number;
  tableIds: Set<string>;
};

export default function SeatingWarnings({ tables, guests }: Props) {
  const totalSeats = tables.reduce((total, table) => total + table.capacity, 0);

  const unassignedCount = guests.filter(
    (guest) => guest.assignedTableId === null,
  ).length;

  const pendingCount = guests.filter(
    (guest) => guest.bookingStatus === "PENDING",
  ).length;

  const seatShortfall = Math.max(0, guests.length - totalSeats);

  const tableNames = new Map(tables.map((table) => [table.id, table.name]));

  const groups = new Map<string, GroupSummary>();

  for (const guest of guests) {
    if (!guest.tableGroup) continue;

    let group = groups.get(guest.tableGroup.id);

    if (!group) {
      group = {
        id: guest.tableGroup.id,
        name: guest.tableGroup.name,
        guestCount: 0,
        unassignedCount: 0,
        tableIds: new Set<string>(),
      };

      groups.set(group.id, group);
    }

    group.guestCount += 1;

    if (guest.assignedTableId) {
      group.tableIds.add(guest.assignedTableId);
    } else {
      group.unassignedCount += 1;
    }
  }

  const groupsNeedingAttention = [...groups.values()]
    .filter((group) => group.tableIds.size > 1 || group.unassignedCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const largestTableCapacity = tables.reduce(
    (largest, table) => Math.max(largest, table.capacity),
    0,
  );

  const oversizedGroups = [...groups.values()]
    .filter((group) => group.guestCount > largestTableCapacity)
    .sort((a, b) => a.name.localeCompare(b.name));

  const hasWarnings =
    unassignedCount > 0 ||
    seatShortfall > 0 ||
    groupsNeedingAttention.length > 0 ||
    oversizedGroups.length > 0;

  return (
    <section aria-labelledby="seating-checks-heading">
      <h2 id="seating-checks-heading">Seating checks</h2>

      <p>
        {guests.length} guests · {totalSeats} seats
      </p>

      {pendingCount > 0 && (
        <p>
          Includes {pendingCount} guests whose bookings aren't confirmed yet.
        </p>
      )}

      {guests.length === 0 ? (
        <p>No guests to seat yet.</p>
      ) : !hasWarnings ? (
        <p>
          Everyone has a seat. Groups are seated together.
        </p>
      ) : (
        <>
          {seatShortfall > 0 && (
            <p>
              Add {seatShortfall} more seats.
            </p>
          )}

          {unassignedCount > 0 && (
            <p>
              Still need a table: {unassignedCount}.
            </p>
          )}

          {groupsNeedingAttention.length > 0 && (
            <>
              <h3>Groups needing attention</h3>

              <ul>
                {groupsNeedingAttention.map((group) => (
                  <li key={group.id}>
                    <strong>{group.name}</strong>
                    {" — "}
                    {group.guestCount} guests.
                    {group.tableIds.size > 1 && (
                      <>
                        {" "}
                        Split across{" "}
                        {[...group.tableIds]
                          .map((id) => tableNames.get(id) ?? "Unknown table")
                          .join(", ")}
                        .
                      </>
                    )}
                    {group.unassignedCount > 0 && (
                      <> Still need a table: {group.unassignedCount}.</>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {oversizedGroups.length > 0 && (
            <>
              <h3>Groups that need a larger table</h3>

              <ul>
                {oversizedGroups.map((group) => (
                  <li key={group.id}>
                    {group.name}: {group.guestCount} guests. No table is large enough for this group.
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
