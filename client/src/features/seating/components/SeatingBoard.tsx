import { Button } from "../../../components/ui/Button";
import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import type { EventTableSummary, SeatingGuest } from "../api";
import { useAssignGuestTable } from "../hooks";

const UNASSIGNED = "unassigned";

type Props = {
  eventId: string;
  tables: EventTableSummary[];
  guests: SeatingGuest[];
  canEdit: boolean;
};

export default function SeatingBoard({
  eventId,
  tables,
  guests,
  canEdit,
}: Props) {
  const mutation = useAssignGuestTable(eventId);
  const [dropError, setDropError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const disabled = !canEdit || mutation.isPending;

  function handleDragEnd(event: DragEndEvent) {
    if (disabled || !event.over) return;

    const guest = guests.find((item) => item.id === String(event.active.id));

    if (!guest) return;

    const targetId = String(event.over.id);
    const tableId = targetId === UNASSIGNED ? null : targetId;

    if (guest.assignedTableId === tableId) return;

    if (tableId !== null) {
      const table = tables.find((item) => item.id === tableId);

      if (!table) return;

      if (table.occupiedSeats >= table.capacity) {
        setDropError(`${table.name} is full.`);
        return;
      }
    }

    mutation.mutate({
      guestId: guest.id,
      tableId,
    });
  }

  return (
    <section aria-labelledby="seating-board-heading">
      <h2 id="seating-board-heading">Seating board</h2>

      <p>Drag guests between tables. Changes save automatically.</p>

      {mutation.isPending && <p role="status">Saving...</p>}

      {(dropError || mutation.error) && (
        <p role="alert">{dropError ?? mutation.error?.message}</p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={() => {
          setDropError(null);
          mutation.reset();
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] items-start gap-4">
          <TableDropZone
            id={UNASSIGNED}
            title="Not seated yet"
            guests={guests.filter((guest) => guest.assignedTableId === null)}
            disabled={disabled}
          />

          {tables.map((table) => (
            <TableDropZone
              key={table.id}
              id={table.id}
              title={table.name}
              capacity={table.capacity}
              guests={guests.filter(
                (guest) => guest.assignedTableId === table.id,
              )}
              disabled={disabled}
            />
          ))}
        </div>
      </DndContext>
    </section>
  );
}

function TableDropZone({
  id,
  title,
  capacity,
  guests,
  disabled,
}: {
  id: string;
  title: string;
  capacity?: number;
  guests: SeatingGuest[];
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled,
  });

  const isFull = capacity !== undefined && guests.length >= capacity;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`drop-zone-${id}`}
      className={`min-h-[160px] rounded-md border-2 p-4 text-ink ${
        isOver
          ? `bg-raised ${isFull ? "border-red-400/50" : "border-ink"}`
          : "border-line bg-surface"
      }`}
    >
      <h3 id={`drop-zone-${id}`} className="mt-0">
        {title}
      </h3>

      <p>
        {capacity === undefined
          ? `${guests.length} guests`
          : `${guests.length} / ${capacity} seats`}
        {isFull ? " — Full" : ""}
      </p>

      {guests.length === 0 ? (
        <p>{disabled ? "No guests." : "Drop a guest here."}</p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0 [&>li]:mt-0">
          {guests.map((guest) => (
            <li key={guest.id}>
              <DraggableGuest guest={guest} disabled={disabled} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DraggableGuest({
  guest,
  disabled,
}: {
  guest: SeatingGuest;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: guest.id,
      disabled,
    });

  return (
    <Button
      variant="secondary"
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      disabled={disabled}
      className={`relative block w-full touch-none p-3 text-left disabled:opacity-100 disabled:cursor-default ${
        disabled
          ? "cursor-default"
          : isDragging
            ? "cursor-grabbing"
            : "cursor-grab"
      } ${isDragging ? "z-10 opacity-80" : "opacity-100"}`}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
    >
      <strong className="block">
        {guest.fullName || `Unnamed guest ${guest.position}`}
      </strong>

      <span className="block font-normal text-muted">
        {guest.tier === "VIP" ? "VIP" : "Standard"}
        {" · "}
        {guest.bookingStatus === "CONFIRMED" ? "Confirmed" : "Pending"}
      </span>

      <span className="block font-normal text-muted">
        Group: {guest.tableGroup?.name ?? "No group"}
      </span>

      <small className="mt-2 block font-normal text-muted wrap-anywhere">
        Booking: {guest.bookingId}
      </small>
    </Button>
  );
}
