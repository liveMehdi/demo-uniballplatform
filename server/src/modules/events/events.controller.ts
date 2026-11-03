import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../lib/auth.js";

import {
  createEventSchema,
  createMealOptionSchema,
  updateEventCapacitySchema,
  updateMealOptionSchema,
} from "./events.schema.js";
import {
  createEvent,
  createMealOption,
  findEventById,
  listEvents,
  listOrganiserEvents,
  updateEventCapacity,
  listMealOptions,
  updateMealOption,
} from "./events.service.js";

import { Prisma } from "../../generated/prisma/client.js";
export async function getEvents(_req: Request, res: Response) {
  const events = await listEvents();

  res.json(events);
}
export async function postEvent(req: Request, res: Response) {
  const result = createEventSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Invalid event details",
      issues: result.error.issues,
    });
    return;
  }

  const userId = res.locals.auth.user.id;
  const event = await createEvent(result.data, userId);

  if (!event) {
    res.status(403).json({
      error: "You must be an organiser of this society.",
    });
    return;
  }

  res.status(201).json(event);
}

export async function getEvent(
  req: Request<{ eventId: string }>,
  res: Response,
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  res.setHeader("Cache-Control", "private, no-store");
  const event = await findEventById(req.params.eventId, session?.user.id);

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(event);
}

export async function getOrganiserEvents(_req: Request, res: Response) {
  const events = await listOrganiserEvents(res.locals.auth.user.id);

  res.json(events);
}

export async function patchEventCapacity(
  req: Request<{ eventId: string }>,
  res: Response,
) {
  const parsed = updateEventCapacitySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Capacity must be a positive whole number.",
    });
    return;
  }

  const result = await updateEventCapacity(
    req.params.eventId,
    res.locals.auth.user.id,
    parsed.data.capacity,
  );

  switch (result.status) {
    case "updated":
      res.json(result.event);
      return;

    case "not_found":
      res.status(404).json({ error: "Event not found" });
      return;

    case "forbidden":
      res.status(403).json({
        error: "You must organise this event's society.",
      });
      return;

    case "invalid":
      res.status(409).json({ error: result.message });
      return;

    case "busy":
      res.status(503).json({
        error: "Event is busy. Please try again.",
      });
      return;
  }
}

export async function postMealOption(
  req: Request<{ eventId: string }>,
  res: Response,
) {
  const parsed = createMealOptionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Provide a meal name and a valid description.",
      issues: parsed.error.issues,
    });
    return;
  }

  try {
    const result = await createMealOption(
      req.params.eventId,
      res.locals.auth.user.id,
      parsed.data,
    );

    res.status(201).json(result.mealOption);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        error: "A meal option with this name already exists.",
      });
      return;
    }

    throw error;
  }
}

export async function getMealOptions(
  req: Request<{ eventId: string }>,
  res: Response,
) {
  res.setHeader("Cache-Control", "no-store");
  res.json(await listMealOptions(req.params.eventId, res.locals.auth.user.id));
}

export async function patchMealOption(
  req: Request<{ eventId: string; mealOptionId: string }>,
  res: Response,
) {
  const parsed = updateMealOptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        error: "Provide a meal name, valid description and availability.",
      });
    return;
  }
  try {
    await updateMealOption(
      req.params.eventId,
      req.params.mealOptionId,
      res.locals.auth.user.id,
      parsed.data,
    );
    res.sendStatus(204);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res
        .status(409)
        .json({ error: "A meal option with this name already exists." });
      return;
    }
    throw error;
  }
}
