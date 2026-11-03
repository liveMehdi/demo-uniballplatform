import type { Request, Response } from "express";
import {
  changeSocietyOrganiser,
  listOrganisedSocieties,
  listSocietyOrganisers,
} from "./societies.service.js";
import { addOrganiserSchema } from "./societies.schema.js";

export async function getSocietyOrganisers(
  req: Request<{ societyId: string }>,
  res: Response,
) {
  res.setHeader("Cache-Control", "no-store");
  res.json(
    await listSocietyOrganisers(req.params.societyId, res.locals.auth.user.id),
  );
}

export async function postSocietyOrganiser(
  req: Request<{ societyId: string }>,
  res: Response,
) {
  const parsed = addOrganiserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide a valid account email." });
    return;
  }
  await changeSocietyOrganiser(req.params.societyId, res.locals.auth.user.id, {
    kind: "add",
    email: parsed.data.email,
  });
  res.sendStatus(204);
}

export async function deleteSocietyOrganiser(
  req: Request<{ societyId: string; userId: string }>,
  res: Response,
) {
  await changeSocietyOrganiser(req.params.societyId, res.locals.auth.user.id, {
    kind: "remove",
    userId: req.params.userId,
  });
  res.sendStatus(204);
}

export async function getOrganisedSocieties(_req: Request, res: Response) {
  const societies = await listOrganisedSocieties(res.locals.auth.user.id);

  res.json(societies);
}
