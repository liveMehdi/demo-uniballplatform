import { checkResponse } from "../../lib/apiError.ts";

export type TableGroupSummary = {
  id: string;
  name: string;
  inviteCode: string;
  maxSize: number;
};

export type GroupAction =
  | { kind: "create"; name: string }
  | { kind: "join"; inviteCode: string }
  | { kind: "leave" };

export async function changeGuestGroup(
  guestId: string,
  action: GroupAction,
): Promise<{ group: TableGroupSummary | null }> {
  let url: string;
  let method: string;
  let body: string | undefined;

  switch (action.kind) {
    case "create":
      url = "/api/seating/groups";
      method = "POST";
      body = JSON.stringify({ guestId, name: action.name });
      break;

    case "join":
      url = "/api/seating/groups/join";
      method = "POST";
      body = JSON.stringify({
        guestId,
        inviteCode: action.inviteCode,
      });
      break;

    case "leave":
      url = `/api/seating/guests/${encodeURIComponent(guestId)}/group`;
      method = "DELETE";
      break;
  }

  const response = await fetch(url, {
    method,
    ...(body !== undefined
      ? {
          headers: { "Content-Type": "application/json" },
          body,
        }
      : {}),
  });

  await checkResponse(response, "Could not update seating group.");

  return response.json();
}

export type EventTableSummary = {
  id: string;
  name: string;
  capacity: number;
  occupiedSeats: number;
};

export type SeatingGuest = {
  id: string;
  fullName: string | null;
  position: number;
  assignedTableId: string | null;
  tableGroup: {
    id: string;
    name: string;
  } | null;
  bookingId: string;
  bookingStatus: "PENDING" | "CONFIRMED";
  tier: "STANDARD" | "VIP";
};

export type SeatingOverview = {
  event: {
    id: string;
    title: string;
    startsAt: string;
    seatingPublishedAt: string | null;
    cancelledAt: string | null;
  };
  tables: EventTableSummary[];
  guests: SeatingGuest[];
};

export async function getEventSeating(
  eventId: string,
  signal?: AbortSignal,
): Promise<SeatingOverview> {
  const response = await fetch(
    `/api/seating/events/${encodeURIComponent(eventId)}/overview`,
    { signal },
  );

  await checkResponse(response, "Could not load seating.");

  return response.json();
}

export async function createEventTable(
  eventId: string,
  input: { name: string; capacity: number },
): Promise<void> {
  const response = await fetch(
    `/api/seating/events/${encodeURIComponent(eventId)}/tables`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  await checkResponse(response, "Could not create table.");
}

export async function assignGuestTable(
  eventId: string,
  guestId: string,
  tableId: string | null,
): Promise<void> {
  const response = await fetch(
    `/api/seating/events/${encodeURIComponent(eventId)}/guests/${encodeURIComponent(guestId)}/table`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId }),
    },
  );

  await checkResponse(response, "Could not update assignment.");
}

export async function assignGroupTable(
  eventId: string,
  groupId: string,
  tableId: string | null,
): Promise<void> {
  const response = await fetch(
    `/api/seating/events/${encodeURIComponent(eventId)}/groups/${encodeURIComponent(groupId)}/table`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId }),
    },
  );

  await checkResponse(response, "Could not update group seating.");
}

export async function updateEventTable(
  eventId: string,
  tableId: string,
  input: { name: string; capacity: number },
): Promise<void> {
  const response = await fetch(
    `/api/seating/events/${encodeURIComponent(eventId)}/tables/${encodeURIComponent(tableId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  await checkResponse(response, "Could not update table.");
}

export async function deleteEventTable(
  eventId: string,
  tableId: string,
): Promise<void> {
  const response = await fetch(
    `/api/seating/events/${encodeURIComponent(eventId)}/tables/${encodeURIComponent(tableId)}`,
    {
      method: "DELETE",
    },
  );

  await checkResponse(response, "Could not delete table.");
}

export type BookingSeating = {
  visibility: "not_confirmed" | "hidden" | "published";
  guests: {
    id: string;
    fullName: string | null;
    position: number;
    tableName: string | null;
  }[];
};

export async function setSeatingPublication(
  eventId: string,
  published: boolean,
): Promise<void> {
  const response = await fetch(
    `/api/seating/events/${encodeURIComponent(eventId)}/publication`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    },
  );

  await checkResponse(response, "Could not change seating publication.");
}

export async function getBookingSeating(
  bookingId: string,
  signal?: AbortSignal,
): Promise<BookingSeating> {
  const response = await fetch(
    `/api/seating/bookings/${encodeURIComponent(bookingId)}`,
    { signal },
  );

  await checkResponse(response, "Could not load your seating.");

  return response.json();
}
