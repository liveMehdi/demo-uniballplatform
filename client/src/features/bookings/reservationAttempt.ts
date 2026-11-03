import type { CreateBookingInput } from "./api";

// only unresolved requests are stored
export function reservationStorageKey(userId: string, eventId: string) {
  return `reservation:${encodeURIComponent(userId)}:${encodeURIComponent(eventId)}`;
}

export function readReservationAttempt(
  storage: Pick<Storage, "getItem">,
  key: string,
): CreateBookingInput | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  const value = JSON.parse(raw);
  if (
    typeof value?.requestKey !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(value.requestKey) ||
    !Array.isArray(value.items) ||
    !value.items.length ||
    value.items.length > 2 ||
    !value.items.every(
      (item: { ticketTypeId?: unknown; quantity?: unknown }) =>
        typeof item?.ticketTypeId === "string" &&
        item.ticketTypeId.length > 0 &&
        typeof item.quantity === "number" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 10,
    ) ||
    value.items.reduce(
      (sum: number, item: { quantity: number }) => sum + item.quantity,
      0,
    ) > 10 ||
    new Set(
      value.items.map((item: { ticketTypeId: string }) => item.ticketTypeId),
    ).size !== value.items.length
  )
    throw new Error("Could not recover the previous reservation request.");
  return value;
}
