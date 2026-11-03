import { checkResponse } from "../../lib/apiError.ts";

import type { TableGroupSummary } from "../seating/api";

export type CreateBookingInput = {
  requestKey: string;
  items: {
    ticketTypeId: string;
    quantity: number;
  }[];
};

export type Booking = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
  totalPence: number;
  simulatedPaymentAt: string | null;
  expiresAt: string;
};

export class BookingRequestError extends Error {
  readonly notCreated: boolean;

  constructor(message: string, notCreated: boolean) {
    super(message);
    this.notCreated = notCreated;
  }
}

export async function createBooking(
  eventId: string,
  input: CreateBookingInput,
): Promise<Booking> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/bookings`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    throw new BookingRequestError(
      typeof body?.error === "string"
        ? body.error
        : "Could not create booking.",
      body?.outcome === "not_created",
    );
  }

  return response.json();
}

export type MyBooking = Booking & {
  createdAt: string;
  event: {
    id: string;
    title: string;
    startsAt: string;
  };
  items: {
    id: string;
    quantity: number;
    unitPricePence: number;
    ticketType: {
      tier: "STANDARD" | "VIP";
    };
  }[];
};

export async function getMyBookings(
  signal?: AbortSignal,
): Promise<MyBooking[]> {
  const response = await fetch("/api/bookings", { signal });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Please log in to view your bookings."
        : "Could not load your bookings.",
    );
  }

  return response.json();
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const response = await fetch(
    `/api/bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      method: "POST",
    },
  );

  await checkResponse(response, "Could not cancel booking.");
}

export type EventBookingList = {
  event: {
    id: string;
    title: string;
  };
  bookings: {
    id: string;
    status: Booking["status"];
    totalPence: number;
    simulatedPaymentAt: string | null;
    createdAt: string;
    user: {
      name: string;
      email: string;
    };
    items: {
      id: string;
      quantity: number;
      ticketType: {
        tier: "STANDARD" | "VIP";
      };
    }[];
  }[];
  page: number;
  hasMore: boolean;
};

export async function getEventBookings(
  eventId: string,
  page: number,
  signal?: AbortSignal,
): Promise<EventBookingList> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/bookings?page=${page}`,
    { signal },
  );

  await checkResponse(response, "Could not load event bookings.");

  return response.json();
}

export type GuestDetailsInput = {
  expectedUpdatedAt: string;
  fullName: string;
  dietaryRequirements: string;
  accessibilityNeeds: string;
  mealOptionId: string | null;
};

export type BookingGuest = {
  updatedAt: string;
  id: string;
  position: number;
  fullName: string | null;
  dietaryRequirements: string | null;
  accessibilityNeeds: string | null;
  mealOptionId: string | null;
  mealOption: {
    id: string;
    name: string;
    isAvailable: boolean;
  } | null;
  tableGroup: TableGroupSummary | null;
};

export type BookingGuestDetails = {
  totalPence: number;
  simulatedPaymentAt: string | null;
  canEditCatering: boolean;
  id: string;
  status: Booking["status"];
  expiresAt: string;
  canEdit: boolean;
  event: {
    id: string;
    title: string;
    startsAt: string;
    cateringDeadline: string | null;
    mealOptions: {
      id: string;
      name: string;
      description: string | null;
    }[];
  };
  items: {
    id: string;
    quantity: number;
    unitPricePence: number;
    ticketType: {
      tier: "STANDARD" | "VIP";
    };
    guests: BookingGuest[];
  }[];
};

export async function getBookingGuests(
  bookingId: string,
  signal?: AbortSignal,
): Promise<BookingGuestDetails> {
  const response = await fetch(
    `/api/bookings/${encodeURIComponent(bookingId)}/guests`,
    { signal },
  );

  await checkResponse(response, "Could not load guest details.");

  return response.json();
}

export async function updateBookingGuest(
  bookingId: string,
  guestId: string,
  input: GuestDetailsInput,
): Promise<{ updatedAt: string }> {
  const response = await fetch(
    `/api/bookings/${encodeURIComponent(bookingId)}/guests/${encodeURIComponent(guestId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  await checkResponse(response, "Could not save guest details.");
  return response.json();
}

export type GuestListStatus = "PENDING" | "CONFIRMED";

export type EventGuestList = {
  event: {
    id: string;
    title: string;
  };
  bookingStatus: GuestListStatus;
  summary: {
    totalGuests: number;
    namedGuests: number;
    missingNames: number;
    dietaryRequests: number;
    accessibilityRequests: number;
    missingMealChoices: number;
    meals: {
      mealOptionId: string;
      name: string;
      count: number;
    }[];
  };
  guests: {
    id: string;
    bookingId: string;
    position: number;
    tier: "STANDARD" | "VIP";
    fullName: string | null;
    dietaryRequirements: string | null;
    accessibilityNeeds: string | null;
    mealOption: {
      id: string;
      name: string;
      isAvailable: boolean;
    } | null;
    tableGroup: {
      id: string;
      name: string;
    } | null;
  }[];
};

export async function getEventGuests(
  eventId: string,
  status: GuestListStatus,
  signal?: AbortSignal,
): Promise<EventGuestList> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/guests?status=${status}`,
    { signal },
  );

  await checkResponse(response, "Could not load event guests.");

  return response.json();
}

export async function downloadCateringCsv(
  eventId: string,
  status: GuestListStatus,
): Promise<void> {
  const response = await fetch(
    `/api/organiser/events/${encodeURIComponent(eventId)}/catering.csv?status=${status}`,
  );

  await checkResponse(response, "Could not export catering report.");

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    status === "CONFIRMED"
      ? "catering-confirmed.csv"
      : "catering-pending-preview.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function confirmBooking(
  bookingId: string,
  mode: "free" | "simulated" = "free",
): Promise<void> {
  const action = mode === "simulated" ? "demo-checkout" : "confirm";
  const response = await fetch(
    `/api/bookings/${encodeURIComponent(bookingId)}/${action}`,
    { method: "POST" },
  );
  await checkResponse(response, "Could not confirm your booking.");
}
