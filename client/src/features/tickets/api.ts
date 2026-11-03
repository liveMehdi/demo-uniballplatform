import { checkResponse } from "../../lib/apiError.ts";

export type CreateTicketTypeInput = {
  tier: "STANDARD" | "VIP";
  pricePence: number;
  capacity: number;
  salesStart: string;
  salesEnd: string;
};

export async function createTicketType(
  eventId: string,
  input: CreateTicketTypeInput,
) {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/ticket-types`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  await checkResponse(response, "Could not create ticket type.");

  return response.json();
}

export type BookingTickets = {
  bookingId: string;
  event: {
    id: string;
    title: string;
    venue: string;
    startsAt: string;
  };
  tickets: {
    id: string;
    guestId: string;
    fullName: string | null;
    position: number;
    tier: "STANDARD" | "VIP";
    token: string | null;
    revokedAt: string | null;
    checkedInAt: string | null;
  }[];
};

export async function prepareBookingTickets(
  bookingId: string,
): Promise<BookingTickets> {
  const response = await fetch(
    `/api/bookings/${encodeURIComponent(bookingId)}/tickets`,
    {
      method: "POST",
    },
  );

  await checkResponse(response, "Could not load tickets.");

  return response.json();
}

export type CheckInResult =
  | {
      status: "checked_in";
      ticket: {
        id: string;
        fullName: string | null;
        position: number;
        tier: "STANDARD" | "VIP";
        checkedInAt: string;
      };
    }
  | {
      status: "already_checked_in";
      error: string;
      checkedInAt: string;
    }
  | {
      status: "invalid" | "conflict";
      error: string;
    };

export async function checkInTicket(
  eventId: string,
  credential: string,
  lookupBy: "token" | "id" = "token",
): Promise<CheckInResult> {
  const suffix = lookupBy === "id" ? "/manual" : "";

  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/check-in${suffix}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        lookupBy === "id" ? { ticketId: credential } : { token: credential },
      ),
    },
  );

  const body = await response.json().catch(() => null);

  if (response.ok) {
    return body as CheckInResult;
  }

  if (
    response.status === 409 &&
    (body?.status === "already_checked_in" ||
      body?.status === "invalid" ||
      body?.status === "conflict")
  ) {
    return body as CheckInResult;
  }

  throw new Error(
    typeof body?.error === "string"
      ? body.error
      : "Could not complete check-in. Check the connection and try again.",
  );
}

export type TicketTypeUpdate = {
  expectedUpdatedAt: string;
  pricePence: number;
  capacity: number;
  salesStart: string;
  salesEnd: string;
};

export type TicketManagementAction =
  | {
      kind: "update";
      ticketTypeId: string;
      input: TicketTypeUpdate;
    }
  | {
      kind: "revoke";
      ticketId: string;
    };

export async function manageEventTicket(
  eventId: string,
  action: TicketManagementAction,
): Promise<void> {
  const base = `/api/events/${encodeURIComponent(eventId)}`;

  const response =
    action.kind === "update"
      ? await fetch(
          `${base}/ticket-types/${encodeURIComponent(action.ticketTypeId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.input),
          },
        )
      : await fetch(
          `${base}/tickets/${encodeURIComponent(action.ticketId)}/revoke`,
          { method: "POST" },
        );

  await checkResponse(response, "Could not update tickets.");
}

export async function requestTicketEmail(bookingId: string): Promise<void> {
  const response = await fetch(
    `/api/bookings/${encodeURIComponent(bookingId)}/email-tickets`,
    { method: "POST" },
  );

  await checkResponse(response, "Could not request the email.");
}
