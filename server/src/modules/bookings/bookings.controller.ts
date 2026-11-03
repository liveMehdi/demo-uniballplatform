import type { Request, Response } from "express";
import {
  createBookingSchema,
  bookingListQuerySchema,
  updateBookingGuestSchema,
  eventGuestListQuerySchema,
} from "./bookings.schema.js";
import {
  cancelBooking,
  createBooking,
  listMyBookings,
  listEventBookings,
  updateBookingGuest,
  getBookingGuests,
  listEventGuests,
} from "./bookings.service.js";
import {
  confirmFreeBooking,
  completeDemoCheckout,
} from "./confirmation.service.js";
import { buildCsv } from "../../lib/csv.js";

export async function postBooking(
  req: Request<{ eventId: string }>,
  res: Response,
) {
  const parsed = createBookingSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid booking details",
      issues: parsed.error.issues,
    });
    return;
  }

  const result = await createBooking(
    req.params.eventId,
    res.locals.auth.user.id,
    parsed.data,
  );

  switch (result.status) {
    case "created":
      res.status(201).json(result.booking);
      return;

    case "replayed":
      res.status(200).json(result.booking);
      return;

    case "not_found":
      res
        .status(404)
        .json({ error: "Event not found", outcome: "not_created" });
      return;

    case "invalid":
      res.status(400).json({ error: result.message, outcome: "not_created" });
      return;

    case "unavailable":
      res.status(409).json({ error: result.message, outcome: "not_created" });
      return;

    case "conflict":
      res.status(409).json({ error: result.message });
      return;

    case "busy":
      res.status(503).json({ error: result.message });
      return;
  }
}

export async function getMyBookings(_req: Request, res: Response) {
  const bookings = await listMyBookings(res.locals.auth.user.id);

  res.json(bookings);
}

export async function postCancelBooking(
  req: Request<{ bookingId: string }>,
  res: Response,
) {
  const result = await cancelBooking(
    req.params.bookingId,
    res.locals.auth.user.id,
  );

  switch (result.status) {
    case "cancelled":
      res.status(200).json({ status: "CANCELLED" });
      return;

    case "not_found":
      res.status(404).json({ error: "Booking not found" });
      return;

    case "not_cancellable":
      res.status(409).json({
        error: "Only active pending reservations can be cancelled.",
      });
      return;
  }
}

export async function getEventBookings(
  req: Request<{ eventId: string }>,
  res: Response,
) {
  const parsed = bookingListQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid page number." });
    return;
  }

  const result = await listEventBookings(
    req.params.eventId,
    res.locals.auth.user.id,
    parsed.data.page,
  );

  switch (result.status) {
    case "not_found":
      res.status(404).json({ error: "Event not found" });
      return;

    case "forbidden":
      res.status(403).json({
        error: "You must organise this event's society.",
      });
      return;

    case "ok":
      res.json(result.data);
      return;
  }
}

export async function getBookingGuestDetails(
  req: Request<{ bookingId: string }>,
  res: Response,
) {
  const booking = await getBookingGuests(
    req.params.bookingId,
    res.locals.auth.user.id,
  );

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json(booking);
}

export async function patchBookingGuest(
  req: Request<{ bookingId: string; guestId: string }>,
  res: Response,
) {
  const parsed = updateBookingGuestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Check the guest name and requirements.",
      issues: parsed.error.issues,
    });
    return;
  }

  const result = await updateBookingGuest(
    req.params.bookingId,
    req.params.guestId,
    res.locals.auth.user.id,
    parsed.data,
  );

  switch (result.status) {
    case "updated":
      res.status(200).json({ status: "updated", updatedAt: result.updatedAt });
      return;

    case "conflict":
      res.status(409).json({
        error:
          "These guest details have changed. Reload the latest details before saving.",
      });
      return;

    case "not_found":
      res.status(404).json({ error: "Guest not found" });
      return;

    case "not_editable":
      res.status(409).json({
        error: "Guest details can no longer be edited for this booking.",
      });
      return;
    case "catering_locked":
      res.status(409).json({
        error:
          "Meal choices and dietary requirements are locked after the catering deadline.",
      });
      return;

    case "incomplete":
      res.status(409).json({
        error:
          "A guest name and, for catered events, a meal choice are required.",
      });
      return;

    case "invalid_meal":
      res.status(400).json({
        error: "Choose an available meal from this event's menu.",
      });
      return;
  }
}

export async function getEventGuests(
  req: Request<{ eventId: string }>,
  res: Response,
) {
  const parsed = eventGuestListQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: "Status must be PENDING or CONFIRMED.",
    });
    return;
  }

  const result = await listEventGuests(
    req.params.eventId,
    res.locals.auth.user.id,
    parsed.data.status,
  );

  switch (result.status) {
    case "not_found":
      res.status(404).json({ error: "Event not found" });
      return;

    case "forbidden":
      res.status(403).json({
        error: "You must organise this event's society.",
      });
      return;

    case "ok":
      res.setHeader("Cache-Control", "no-store");
      res.json(result.data);
      return;
  }
}

export async function downloadCateringCsv(
  req: Request<{ eventId: string }>,
  res: Response,
) {
  const parsed = eventGuestListQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: "Status must be PENDING or CONFIRMED.",
    });
    return;
  }

  const result = await listEventGuests(
    req.params.eventId,
    res.locals.auth.user.id,
    parsed.data.status,
  );

  if (result.status === "not_found") {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (result.status === "forbidden") {
    res.status(403).json({
      error: "You must organise this event's society.",
    });
    return;
  }

  const { event, bookingStatus, guests } = result.data;

  const rows: (string | number | null)[][] = [
    [
      "Event",
      "Booking status",
      "Booking reference",
      "Guest ID",
      "Guest name",
      "Ticket tier",
      "Meal choice",
      "Dietary requirements",
    ],
  ];

  for (const guest of guests) {
    rows.push([
      event.title,
      bookingStatus,
      guest.bookingId,
      guest.id,
      guest.fullName ?? "Name not provided",
      guest.tier,
      guest.mealOption?.name ?? "No meal selected",
      guest.dietaryRequirements ?? "No information supplied",
    ]);
  }

  const filename =
    bookingStatus === "CONFIRMED"
      ? "catering-confirmed.csv"
      : "catering-pending-preview.csv";

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  res.send(buildCsv(rows));
}

export async function postConfirmBooking(
  req: Request<{ bookingId: string }>,
  res: Response,
) {
  res.json(
    await confirmFreeBooking(req.params.bookingId, res.locals.auth.user.id),
  );
}

export async function postDemoCheckout(
  req: Request<{ bookingId: string }>,
  res: Response,
) {
  res.setHeader("Cache-Control", "no-store");
  res.json(
    await completeDemoCheckout(req.params.bookingId, res.locals.auth.user.id),
  );
}
