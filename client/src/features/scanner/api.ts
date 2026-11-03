import { checkResponse } from "../../lib/apiError.ts";

export type ScannerEvent = {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
};

export type ScanStaff = {
  id: string;
  name: string;
  email: string;
};

export async function getScannerEvents(
  signal?: AbortSignal,
): Promise<ScannerEvent[]> {
  const response = await fetch("/api/scanner/events", { signal });
  await checkResponse(response, "Could not complete the request.");
  return response.json();
}

export async function getScanStaff(
  eventId: string,
  signal?: AbortSignal,
): Promise<ScanStaff[]> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/scan-staff`,
    { signal },
  );

  await checkResponse(response, "Could not complete the request.");
  return response.json();
}

export async function addScanStaff(
  eventId: string,
  email: string,
): Promise<void> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/scan-staff`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );

  await checkResponse(response, "Could not complete the request.");
}

export async function removeScanStaff(
  eventId: string,
  userId: string,
): Promise<void> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/scan-staff/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );

  await checkResponse(response, "Could not complete the request.");
}

export type Attendance = {
  confirmedGuests: number;
  checkedIn: number;
  remaining: number;
};

export type GuestSearchResult = {
  hasMore: boolean;
  guests: {
    id: string;
    fullName: string | null;
    position: number;
    bookingId: string;
    tier: "STANDARD" | "VIP";
    ticket: {
      id: string;
      revokedAt: string | null;
      checkedInAt: string | null;
    } | null;
  }[];
};

export async function getAttendance(
  eventId: string,
  signal?: AbortSignal,
): Promise<Attendance> {
  const response = await fetch(
    `/api/scanner/events/${encodeURIComponent(eventId)}/attendance`,
    { signal },
  );

  await checkResponse(response, "Could not complete the request.");
  return response.json();
}

export async function searchGuests(
  eventId: string,
  search: string,
  signal?: AbortSignal,
): Promise<GuestSearchResult> {
  const params = new URLSearchParams({ q: search });

  const response = await fetch(
    `/api/scanner/events/${encodeURIComponent(eventId)}/guests?${params}`,
    { signal },
  );

  await checkResponse(response, "Could not complete the request.");
  return response.json();
}
export async function recoverGuestTicket(
  eventId: string,
  guestId: string,
): Promise<void> {
  const response = await fetch(
    "/api/scanner/events/" +
      encodeURIComponent(eventId) +
      "/guests/" +
      encodeURIComponent(guestId) +
      "/ticket",
    { method: "POST" },
  );
  await checkResponse(response, "Could not complete the request.");
}
