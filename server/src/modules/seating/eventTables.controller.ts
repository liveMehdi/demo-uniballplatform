import type { RequestHandler } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import {
  createEventTableSchema,
  assignGuestTableSchema,
} from "./seating.schema.js";
import {
  createEventTable,
  listEventTables,
  assignGuestTable,
  getSeatingOverview,
  assignGroupTable,
  changeEventTable,
  getBookingSeating,
} from "./eventTables.service.js";

export const postEventTable: RequestHandler = async (
  req,
  res,
  next,
) => {
  const eventId = req.params.eventId;

  if (typeof eventId !== "string") {
    res.status(400).json({ error: "Invalid event ID." });
    return;
  }

  const parsed = createEventTableSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Provide a table name and a positive whole-number capacity.",
    });
    return;
  }

  try {
    const result = await createEventTable(
      eventId,
      res.locals.auth.user.id,
      parsed.data,
    );

    if (result.status === "not_found") {
      res.status(404).json({ error: "Event not found." });
      return;
    }

    if (result.status === "forbidden") {
      res.status(403).json({
        error: "You cannot manage seating for this event.",
      });
      return;
    }

    if (result.status === "conflict") { res.status(409).json({ error: result.error }); return; }
    res.status(201).json(result.table);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        error: "This event already has a table with that name.",
      });
      return;
    }

    next(error);
  }
};

export const getEventTables: RequestHandler = async (
  req,
  res,
  next,
) => {
  const eventId = req.params.eventId;

  if (typeof eventId !== "string") {
    res.status(400).json({ error: "Invalid event ID." });
    return;
  }

  try {
    const result = await listEventTables(
      eventId,
      res.locals.auth.user.id,
    );

    if (result.status === "not_found") {
      res.status(404).json({ error: "Event not found." });
      return;
    }

    if (result.status === "forbidden") {
      res.status(403).json({
        error: "You cannot view seating for this event.",
      });
      return;
    }

    res.setHeader("Cache-Control", "no-store");

    res.json({
      event: result.event,
      tables: result.tables,
    });
  } catch (error) {
    next(error);
  }
};

export const patchGuestTable: RequestHandler = async (
  req,
  res,
  next,
) => {
  const { eventId, guestId } = req.params;

  if (
    typeof eventId !== "string" ||
    typeof guestId !== "string"
  ) {
    res.status(400).json({ error: "Invalid event or guest ID." });
    return;
  }

  const parsed = assignGuestTableSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Provide a valid table ID, or null to remove the assignment.",
    });
    return;
  }

  try {
    const result = await assignGuestTable(
      eventId,
      guestId,
      res.locals.auth.user.id,
      parsed.data.tableId,
    );

    switch (result.status) {
      case "updated":
        res.json(result.guest);
        return;

      case "not_found":
        res.status(404).json({ error: result.error });
        return;

      case "forbidden":
        res.status(403).json({ error: result.error });
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

export const getEventSeating: RequestHandler = async (
  req,
  res,
  next,
) => {
  const eventId = req.params.eventId;

  if (typeof eventId !== "string") {
    res.status(400).json({ error: "Invalid event ID." });
    return;
  }

  try {
    const result = await getSeatingOverview(
      eventId,
      res.locals.auth.user.id,
    );

    if (result.status === "not_found") {
      res.status(404).json({ error: "Event not found." });
      return;
    }

    if (result.status === "forbidden") {
      res.status(403).json({
        error: "You cannot view seating for this event.",
      });
      return;
    }

    res.setHeader("Cache-Control", "no-store");

    res.json({
      event: result.event,
      tables: result.tables,
      guests: result.guests,
    });
  } catch (error) {
    next(error);
  }
};

export const patchGroupTable: RequestHandler = async (
  req,
  res,
  next,
) => {
  const { eventId, groupId } = req.params;

  if (
    typeof eventId !== "string" ||
    typeof groupId !== "string"
  ) {
    res.status(400).json({
      error: "Invalid event or group ID.",
    });
    return;
  }

  const parsed = assignGuestTableSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Provide a valid table ID, or null to unassign the group.",
    });
    return;
  }

  try {
    const result = await assignGroupTable(
      eventId,
      groupId,
      res.locals.auth.user.id,
      parsed.data.tableId,
    );

    switch (result.status) {
      case "updated":
        res.json({
          groupId: result.groupId,
          assignedTableId: result.assignedTableId,
          guestCount: result.guestCount,
        });
        return;

      case "not_found":
        res.status(404).json({ error: result.error });
        return;

      case "forbidden":
        res.status(403).json({ error: result.error });
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

function makeTableChangeHandler(
  action: "update" | "delete",
): RequestHandler {
  return async (req, res, next) => {
    const { eventId, tableId } = req.params;

    if (
      typeof eventId !== "string" ||
      typeof tableId !== "string"
    ) {
      res.status(400).json({
        error: "Invalid event or table ID.",
      });
      return;
    }

    const parsed =
      action === "update"
        ? createEventTableSchema.safeParse(req.body)
        : null;

    if (parsed && !parsed.success) {
      res.status(400).json({
        error: "Provide a table name and a positive whole-number capacity.",
      });
      return;
    }

    const change =
      parsed?.success
        ? {
            kind: "update" as const,
            name: parsed.data.name,
            capacity: parsed.data.capacity,
          }
        : {
            kind: "delete" as const,
          };

    try {
      const result = await changeEventTable(
        eventId,
        tableId,
        res.locals.auth.user.id,
        change,
      );

      switch (result.status) {
        case "updated":
          res.json(result.table);
          return;

        case "deleted":
          res.status(204).send();
          return;

        case "not_found":
          res.status(404).json({ error: result.error });
          return;

        case "forbidden":
          res.status(403).json({ error: result.error });
          return;

        case "conflict":
          res.status(409).json({ error: result.error });
          return;

        case "busy":
          res.status(503).json({ error: result.error });
          return;
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        res.status(409).json({
          error: "This event already has a table with that name.",
        });
        return;
      }

      next(error);
    }
  };
}



export const patchEventTable = makeTableChangeHandler("update");

export const deleteEventTable = makeTableChangeHandler("delete");


export const getMyBookingSeating: RequestHandler = async (
  req,
  res,
  next,
) => {
  const bookingId = req.params.bookingId;

  if (typeof bookingId !== "string") {
    res.status(400).json({ error: "Invalid booking ID." });
    return;
  }

  try {
    const result = await getBookingSeating(
      bookingId,
      res.locals.auth.user.id,
    );

    res.setHeader("Cache-Control", "no-store");

    if (!result) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
};