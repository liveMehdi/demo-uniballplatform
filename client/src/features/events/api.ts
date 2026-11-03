import { checkResponse } from "../../lib/apiError.ts";

export type BallEvent = {
  id: string;
  title: string;
  description: string | null;
  venue: string;
  startsAt: string;

  cancelledAt: string | null;
};

export async function getEvents(signal?: AbortSignal): Promise<BallEvent[]> {
  const response = await fetch("/api/events", { signal });

  if (!response.ok) {
    throw new Error("Could not load events");
  }

  return response.json();
}

export type CreateEventInput = {
  title: string;
  description?: string;
  venue: string;
  startsAt: string;
  societyId: string;
  capacity: number;
  cateringDeadline?: string | null;
  bannerUrl?: string | null;
  headingColor?: string | null;
};

export async function createEvent(input: CreateEventInput): Promise<BallEvent> {
  const response = await fetch("/api/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Please log in before creating an event.");
    }

    if (response.status === 403) {
      throw new Error("You must be an organiser of this society.");
    }

    const body = await response.json().catch(() => null);
    const issue = body?.issues?.find(
      (item: { message?: unknown }) => typeof item.message === "string",
    );
    throw new Error(
      issue?.message ??
        (typeof body?.error === "string"
          ? body.error
          : "Could not create event. Check your details."),
    );
  }

  return response.json();
}

export async function getEvent(
  eventId: string,
  signal?: AbortSignal,
): Promise<EventDetails> {
  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404 ? "Event not found" : "Could not load event",
    );
  }

  return response.json();
}

export type TicketTypeSummary = {
  updatedAt: string;
  id: string;
  tier: "STANDARD" | "VIP";
  pricePence: number;
  salesStart: string;
  salesEnd: string;

  capacity: number;
};

export type EventDetails = BallEvent & {
  publishedAt: string | null;
  cateringDeadline: string | null;
  updatedAt: string;
  bannerUrl: string | null;
  headingColor: string | null;
  societyId: string;
  capacity: number | null;
  ticketTypes: TicketTypeSummary[];
  mealOptions: MealOption[];
  salesClosed: boolean;
};

export type OrganiserEventSummary = {
  publishedAt: string | null;
  id: string;
  title: string;
  startsAt: string;
  societyName: string;
  capacity: number | null;
  pendingPlaces: number;
  confirmedPlaces: number;
  remainingPlaces: number | null;
  cancelledAt: string | null;
};

export async function getOrganiserEvents(
  signal?: AbortSignal,
): Promise<OrganiserEventSummary[]> {
  const response = await fetch("/api/organiser/events", { signal });

  if (!response.ok) {
    throw new Error("Could not load your organiser dashboard.");
  }

  return response.json();
}

export async function updateEventCapacity(
  eventId: string,
  capacity: number,
): Promise<{ id: string; capacity: number }> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/capacity`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity }),
    },
  );

  await checkResponse(response, "Could not update capacity.");

  return response.json();
}

export type MealOption = {
  id: string;
  name: string;
  description: string | null;
};

export type CreateMealOptionInput = {
  name: string;
  description: string;
};

export type ManagedMealOption = MealOption & { isAvailable: boolean };
export type UpdateMealOptionInput = CreateMealOptionInput & {
  isAvailable: boolean;
};

export async function getMealOptions(
  eventId: string,
  signal?: AbortSignal,
): Promise<ManagedMealOption[]> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/meal-options`,
    { signal },
  );
  if (!response.ok)
    throw new Error(
      "Could not load meal options. Check you still have organiser access.",
    );
  return response.json();
}

export async function updateMealOption(
  eventId: string,
  mealOptionId: string,
  input: UpdateMealOptionInput,
): Promise<void> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/meal-options/${encodeURIComponent(mealOptionId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  await checkResponse(response, "Could not update meal option.");
}

export async function createMealOption(
  eventId: string,
  input: CreateMealOptionInput,
): Promise<MealOption> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/meal-options`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  await checkResponse(response, "Could not create meal option.");

  return response.json();
}

export type EventDetailsUpdate = {
  cateringDeadline?: string | null;
  expectedUpdatedAt: string;
  bannerUrl?: string | null;
  headingColor?: string | null;
  title: string;
  description: string | null;
  venue: string;
  startsAt: string;
};

export type EventSettingsAction =
  | { kind: "publish" }
  | {
      kind: "details";
      input: EventDetailsUpdate;
    }
  | {
      kind: "sales";
      salesClosed: boolean;
    };

export async function updateEventSettings(
  eventId: string,
  action: EventSettingsAction,
): Promise<void> {
  const body =
    action.kind === "details"
      ? action.input
      : action.kind === "sales"
        ? { salesClosed: action.salesClosed }
        : {};

  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/${action.kind}`,
    {
      method: action.kind === "publish" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  await checkResponse(response, "Could not update the event.");
}
export async function cancelEvent(eventId: string): Promise<void> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "CANCEL" }),
    },
  );

  await checkResponse(response, "Could not cancel the event.");
}
