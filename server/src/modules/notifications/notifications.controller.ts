import type { RequestHandler } from "express";
import { requestTicketEmail } from "./notifications.service.js";

export const postTicketEmail: RequestHandler = async (req, res, next) => {
  const bookingId = req.params.bookingId;

  res.setHeader("Cache-Control", "no-store");

  if (typeof bookingId !== "string") {
    res.status(400).json({ error: "Invalid booking ID." });
    return;
  }

  try {
    const result = await requestTicketEmail(bookingId, res.locals.auth.user.id);

    switch (result.status) {
      case "disabled":
        res.status(403).json({ error: result.error });
        return;

      case "queued":
        res.status(202).json({ message: "Ticket email queued." });
        return;

      case "not_found":
        res.status(404).json({ error: result.error });
        return;

      case "conflict":
        res.status(409).json({ error: result.error });
        return;

      case "limited":
        res.setHeader("Retry-After", "60");
        res.status(429).json({ error: result.error });
        return;

      case "busy":
        res.status(503).json({ error: result.error });
        return;
    }
  } catch (error) {
    next(error);
  }
};
