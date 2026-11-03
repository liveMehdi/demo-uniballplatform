import type { RequestHandler } from "express";
import { z } from "zod";
import { updateTicketTypeSchema } from "./ticketManagement.schema.js";
import {
  TicketManagementError,
  updateTicketType,
  revokeAdmissionTicket,
} from "./ticketManagement.service.js";

export const patchTicketType: RequestHandler = async (req, res, next) => {
  const params = z
    .object({
      eventId: z.uuid(),
      ticketTypeId: z.uuid(),
    })
    .safeParse(req.params);

  const body = updateTicketTypeSchema.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({
      error: "Provide valid ticket details and sale dates.",
    });
    return;
  }

  try {
    await updateTicketType(
      params.data.eventId,
      params.data.ticketTypeId,
      res.locals.auth.user.id,
      body.data,
    );

    res.status(204).send();
  } catch (error) {
    if (error instanceof TicketManagementError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    next(error);
  }
};

export const postRevokeTicket: RequestHandler = async (req, res, next) => {
  const params = z
    .object({
      eventId: z.uuid(),
      ticketId: z.uuid(),
    })
    .safeParse(req.params);

  if (!params.success) {
    res.status(400).json({ error: "Invalid event or ticket reference." });
    return;
  }

  try {
    await revokeAdmissionTicket(
      params.data.eventId,
      params.data.ticketId,
      res.locals.auth.user.id,
    );

    res.status(204).send();
  } catch (error) {
    if (error instanceof TicketManagementError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    next(error);
  }
};
