import type { RequestHandler } from "express";
import { checkInSchema } from "./checkIn.schema.js";
import { checkInTicket } from "./checkIn.service.js";
import { z } from "zod";

const manualCheckInSchema = z.object({
  ticketId: z.uuid(),
});

function makeCheckInHandler(lookupBy: "token" | "id"): RequestHandler {
  return async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");

    const eventId = req.params.eventId;

    if (typeof eventId !== "string") {
      res.status(400).json({ error: "Invalid event ID." });
      return;
    }

    const parsed =
      lookupBy === "token"
        ? checkInSchema.safeParse(req.body)
        : manualCheckInSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Provide a valid ticket code or ticket reference.",
      });
      return;
    }

    const credential =
      "token" in parsed.data ? parsed.data.token : parsed.data.ticketId;

    try {
      const result = await checkInTicket(
        eventId,
        res.locals.auth.user.id,
        credential,
        lookupBy,
      );

      switch (result.status) {
        case "checked_in":
          res.json({
            status: result.status,
            ticket: result.ticket,
          });
          return;

        case "already_checked_in":
          res.status(409).json({
            status: result.status,
            error: result.error,
            checkedInAt: result.checkedInAt,
          });
          return;

        case "invalid":
        case "conflict":
          res.status(409).json({
            status: result.status,
            error: result.error,
          });
          return;

        case "not_found":
          res.status(404).json({ error: result.error });
          return;

        case "forbidden":
          res.status(403).json({ error: result.error });
          return;

        case "busy":
          res.status(503).json({ error: result.error });
          return;
      }
    } catch (error) {
      next(error);
    }
  };
}

export const postCheckIn = makeCheckInHandler("token");

export const postManualCheckIn = makeCheckInHandler("id");
