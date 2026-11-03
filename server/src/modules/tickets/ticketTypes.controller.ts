import type { Request, Response } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { createTicketTypeSchema } from "./ticketTypes.schema.js";
import { createTicketType } from "./ticketTypes.service.js";

export async function postTicketType(
  req: Request<{ eventId: string }>,
  res: Response,
) {
  const parsed = createTicketTypeSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid ticket details",
      issues: parsed.error.issues,
    });
    return;
  }

  try {
    const result = await createTicketType(
      req.params.eventId,
      res.locals.auth.user.id,
      parsed.data,
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

      case "invalid":
        res.status(400).json({ error: result.message });
        return;

      case "created":
        res.status(201).json(result.ticketType);
        return;

      case "busy":
        res.status(503).json({
          error: "Event is busy. Please try again.",
        });
        return;
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        error: "This ticket tier already exists for the event.",
      });
      return;
    }

    throw error;
  }
}
