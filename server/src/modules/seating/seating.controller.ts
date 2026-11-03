import type { Request, RequestHandler, Response } from "express";
import {
  createTableGroupSchema,
  joinTableGroupSchema,
  guestIdSchema,
  seatingPublicationSchema,
} from "./seating.schema.js";
import { changeGuestGroup } from "./seating.service.js";
import { setSeatingPublication } from "./eventTables.service.js";

export async function postTableGroup(req: Request, res: Response) {
  const parsed = createTableGroupSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Provide a guest ID and group name.",
      issues: parsed.error.issues,
    });
    return;
  }

  const result = await changeGuestGroup(
    res.locals.auth.user.id,
    parsed.data.guestId,
    {
      kind: "create",
      name: parsed.data.name,
    },
  );

  res.status(result.status).json(result.body);
}

export async function postJoinTableGroup(req: Request, res: Response) {
  const parsed = joinTableGroupSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Provide a guest ID and valid invite code.",
      issues: parsed.error.issues,
    });
    return;
  }

  const result = await changeGuestGroup(
    res.locals.auth.user.id,
    parsed.data.guestId,
    {
      kind: "join",
      inviteCode: parsed.data.inviteCode,
    },
  );

  res.status(result.status).json(result.body);
}

export async function deleteGuestGroup(
  req: Request<{ guestId: string }>,
  res: Response,
) {
  const parsed = guestIdSchema.safeParse(req.params.guestId);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid guest ID." });
    return;
  }

  const result = await changeGuestGroup(
    res.locals.auth.user.id,
    parsed.data,
    { kind: "leave" },
  );

  res.status(result.status).json(result.body);
}
export const patchSeatingPublication: RequestHandler = async (
  req,
  res,
  next,
) => {
  const eventId = req.params.eventId;

  if (typeof eventId !== "string") {
    res.status(400).json({ error: "Invalid event ID." });
    return;
  }

  const parsed = seatingPublicationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Provide published as true or false.",
    });
    return;
  }

  try {
    const result = await setSeatingPublication(
      eventId,
      res.locals.auth.user.id,
      parsed.data.published,
    );

    switch (result.status) {
      case "updated":
        res.json(result.event);
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