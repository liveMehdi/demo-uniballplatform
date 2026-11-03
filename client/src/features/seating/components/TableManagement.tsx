import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Fields";
import { useState } from "react";
import type { SubmitEvent } from "react";
import type { EventTableSummary } from "../api";
import { useDeleteEventTable, useUpdateEventTable } from "../hooks";

type Props = {
  eventId: string;
  tables: EventTableSummary[];
  canEdit: boolean;
};

export default function TableManagement({ eventId, tables, canEdit }: Props) {
  return (
    <section aria-labelledby="table-management-heading">
      <h2 id="table-management-heading">Manage tables</h2>

      {tables.length === 0 ? (
        <p>No tables created yet.</p>
      ) : (
        tables.map((table) => (
          <TableEditor
            key={table.id}
            eventId={eventId}
            table={table}
            canEdit={canEdit}
          />
        ))
      )}
    </section>
  );
}

function TableEditor({
  eventId,
  table,
  canEdit,
}: {
  eventId: string;
  table: EventTableSummary;
  canEdit: boolean;
}) {
  const updateMutation = useUpdateEventTable(eventId);
  const deleteMutation = useDeleteEventTable(eventId);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(table.name);
  const [capacity, setCapacity] = useState(String(table.capacity));

  const busy = updateMutation.isPending || deleteMutation.isPending;

  function startEditing() {
    setName(table.name);
    setCapacity(String(table.capacity));
    updateMutation.reset();
    deleteMutation.reset();
    setEditing(true);
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit || busy) return;

    updateMutation.mutate(
      {
        tableId: table.id,
        name: name.trim(),
        capacity: Number(capacity),
      },
      {
        onSuccess: () => setEditing(false),
      },
    );
  }

  function handleDelete() {
    if (!canEdit || busy || table.occupiedSeats > 0) return;

    updateMutation.reset();
    deleteMutation.mutate(table.id);
  }

  return (
    <article className="mb-4 rounded-md border border-line bg-canvas p-5 last:mb-0">
      <h3>{table.name}</h3>

      <p className="text-muted">
        {table.occupiedSeats} / {table.capacity} seats occupied
      </p>

      {editing && canEdit ? (
        <form onSubmit={handleSubmit}>
          <fieldset disabled={busy}>
            <legend>Edit table</legend>

            <div className="mb-4">
              <label htmlFor={`table-name-${table.id}`}>Name</label>
              <Input
                id={`table-name-${table.id}`}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  updateMutation.reset();
                }}
                required
                maxLength={80}
              />
            </div>

            <div className="mb-4">
              <label htmlFor={`table-capacity-${table.id}`}>Seats</label>
              <Input
                id={`table-capacity-${table.id}`}
                aria-describedby={table.occupiedSeats > 0 ? `table-capacity-help-${table.id}` : undefined}
                type="number"
                value={capacity}
                onChange={(event) => {
                  setCapacity(event.target.value);
                  updateMutation.reset();
                }}
                min={Math.max(1, table.occupiedSeats)}
                max={2147483647}
                step={1}
                required
              />
              {table.occupiedSeats > 0 && (
                <p id={`table-capacity-help-${table.id}`} className="mt-2 text-sm text-muted">
                  Keep at least {table.occupiedSeats} seats, or move guests first.
                </p>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button type="submit">
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>

              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setEditing(false);
                  updateMutation.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </fieldset>
        </form>
      ) : (
        canEdit && (
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" type="button" disabled={busy} onClick={startEditing}>
              Edit
            </Button>

            <Button
              variant="danger"
              type="button"
              disabled={busy || table.occupiedSeats > 0}
              aria-describedby={table.occupiedSeats > 0 ? `table-delete-help-${table.id}` : undefined}
              onClick={handleDelete}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete empty table"}
            </Button>
          </div>
        )
      )}

      {canEdit && !editing && table.occupiedSeats > 0 && (
        <p id={`table-delete-help-${table.id}`} className="mt-2 text-sm text-muted">
          Move these guests to another table before deleting this one.
        </p>
      )}

      {(updateMutation.error || deleteMutation.error) && (
        <p role="alert">
          {updateMutation.error?.message ?? deleteMutation.error?.message}
        </p>
      )}

      {updateMutation.isSuccess && !editing && (
        <p role="status">Table updated.</p>
      )}
    </article>
  );
}
