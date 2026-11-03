import type { RequestHandler } from "express";
import { z } from "zod";
import { cancelEvent } from "./eventCancellation.service.js";

const cancellationSchema = z.object({
  confirmation: z.literal("CANCEL"),
});

export const postCancelEvent: RequestHandler = async (req, res, next) => {
  const eventId = req.params.eventId;
  const parsed = cancellationSchema.safeParse(req.body);

  if (typeof eventId !== "string" || !parsed.success) {
    res.status(400).json({
      error: "Provide an event ID and confirmation: CANCEL.",
    });
    return;
  }

  try {
    const result = await cancelEvent(eventId, res.locals.auth.user.id);

    res.setHeader("Cache-Control", "no-store");

    switch (result.status) {
      case "cancelled":
        res.json({ cancelledAt: result.cancelledAt });
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
