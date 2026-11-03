import type { RequestHandler } from "express";
import {
  updateEventDetailsSchema,
  setEventSalesSchema,
} from "./events.schema.js";
import type { EventSettingsChange } from "./eventSettings.service.js";
import { changeEventSettings } from "./eventSettings.service.js";

function makeSettingsHandler(
  kind: "details" | "sales" | "publish",
): RequestHandler {
  return async (req, res, next) => {
    const eventId = req.params.eventId;

    if (typeof eventId !== "string") {
      res.status(400).json({ error: "Invalid event ID." });
      return;
    }

    let change: EventSettingsChange;

    if (kind === "publish") {
      change = { kind: "publish" };
    } else if (kind === "details") {
      const parsed = updateEventDetailsSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          error:
            "Check the event details, HTTPS banner URL and preset heading colour.",
        });
        return;
      }

      change = { kind: "details", input: parsed.data };
    } else {
      const parsed = setEventSalesSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          error: "Provide salesClosed as true or false.",
        });
        return;
      }

      change = {
        kind: "sales",
        salesClosed: parsed.data.salesClosed,
      };
    }

    try {
      const result = await changeEventSettings(
        eventId,
        res.locals.auth.user.id,
        change,
      );

      switch (result.status) {
        case "updated":
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
      next(error);
    }
  };
}

export const patchEventDetails = makeSettingsHandler("details");
export const patchEventSales = makeSettingsHandler("sales");
export const postPublishEvent = makeSettingsHandler("publish");
