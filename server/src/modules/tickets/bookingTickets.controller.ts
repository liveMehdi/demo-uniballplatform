import type { RequestHandler } from "express";
import { issueBookingTickets } from "./bookingTickets.service.js";

export const postBookingTickets: RequestHandler = async (req, res, next) => {
  const bookingId = req.params.bookingId;

  res.setHeader("Cache-Control", "no-store");

  if (typeof bookingId !== "string") {
    res.status(400).json({ error: "Invalid booking ID." });
    return;
  }

  try {
    const result = await issueBookingTickets(
      bookingId,
      res.locals.auth.user.id,
    );

    switch (result.status) {
      case "ready":
        res.json({
          bookingId: result.bookingId,
          event: result.event,
          tickets: result.tickets,
        });
        return;

      case "not_found":
        res.status(404).json({ error: result.error });
        return;

      case "conflict":
        res.status(409).json({ error: result.error });
        return;

      case "busy":
        res.status(503).json({ error: result.error });
        return;
    }
  } catch (error) {
    next(error);
  }
};
