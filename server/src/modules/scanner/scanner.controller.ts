import { recoverGuestTicket } from "./scanner.service.js";
import type { RequestHandler } from "express";
import { z } from "zod";
import {
  canManageScanAccess,
  listScannerEvents,
  listEventScanStaff,
  addEventScanStaff,
  removeEventScanStaff,
  canScanEvent,
  getEventAttendance,
  searchEventGuests,
} from "./scanner.service.js";

const addStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const getScannerEvents: RequestHandler = async (_req, res) => {
  const events = await listScannerEvents(res.locals.auth.user.id);

  res.setHeader("Cache-Control", "no-store");
  res.json(events);
};

// runs before every organiser-only staff-management handler
export const requireScanStaffManager: RequestHandler = async (
  req,
  res,
  next,
) => {
  const eventId = req.params.eventId;

  if (typeof eventId !== "string") {
    res.status(400).json({ error: "Invalid event ID." });
    return;
  }

  const allowed = await canManageScanAccess(eventId, res.locals.auth.user.id);

  if (!allowed) {
    res.status(403).json({
      error: "You cannot manage scan access for this event.",
    });
    return;
  }

  res.locals.scanEventId = eventId;
  res.setHeader("Cache-Control", "no-store");
  next();
};

export const getScanStaff: RequestHandler = async (_req, res) => {
  const staff = await listEventScanStaff(res.locals.scanEventId);
  res.json(staff);
};

export const postScanStaff: RequestHandler = async (req, res) => {
  const parsed = addStaffSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const found = await addEventScanStaff(
    res.locals.scanEventId,
    parsed.data.email,
    res.locals.auth.user.id,
  );

  if (!found) {
    res.status(404).json({
      error: "No account found. Ask this person to register first.",
    });
    return;
  }

  res.status(204).send();
};

export const deleteScanStaff: RequestHandler = async (req, res) => {
  const userId = req.params.userId;

  if (typeof userId !== "string") {
    res.status(400).json({ error: "Invalid user ID." });
    return;
  }

  await removeEventScanStaff(
    res.locals.scanEventId,
    userId,
    res.locals.auth.user.id,
  );
  res.status(204).send();
};

export const requireScannerAccess: RequestHandler = async (req, res, next) => {
  const eventId = req.params.eventId;

  if (typeof eventId !== "string") {
    res.status(400).json({ error: "Invalid event ID." });
    return;
  }

  if (!(await canScanEvent(eventId, res.locals.auth.user.id))) {
    res.status(403).json({
      error:
        "Check-in is unavailable or you no longer have access to this event.",
    });
    return;
  }

  res.locals.scanEventId = eventId;
  res.setHeader("Cache-Control", "no-store");
  next();
};

export const getAttendance: RequestHandler = async (_req, res) => {
  res.json(await getEventAttendance(res.locals.scanEventId));
};

export const getGuestSearch: RequestHandler = async (req, res) => {
  const parsed = z.string().trim().min(2).max(200).safeParse(req.query.q);

  if (!parsed.success) {
    res.status(400).json({
      error: "Enter between 2 and 200 characters.",
    });
    return;
  }

  res.json(await searchEventGuests(res.locals.scanEventId, parsed.data));
};

export const postRecoverGuestTicket: RequestHandler = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const { eventId, guestId } = req.params;
  if (typeof eventId !== "string" || typeof guestId !== "string") {
    res.status(400).json({ error: "Invalid event or guest reference." });
    return;
  }
  res.json(await recoverGuestTicket(eventId, guestId, res.locals.auth.user.id));
};
