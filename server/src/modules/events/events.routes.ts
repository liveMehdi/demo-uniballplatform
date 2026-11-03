import { Router } from "express";
import {
  getEvent,
  getEvents,
  postEvent,
  patchEventCapacity,
  postMealOption,
  getMealOptions,
  patchMealOption,
} from "./events.controller.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  postPublishEvent,
  patchEventDetails,
  patchEventSales,
} from "./eventSettings.controller.js";
import { postCancelEvent } from "./eventCancellation.controller.js";
const router = Router();

router.get("/", getEvents);
router.get("/:eventId", getEvent);
router.post("/", requireAuth, postEvent);
router.patch("/:eventId/capacity", requireAuth, patchEventCapacity);
router.post("/:eventId/meal-options", requireAuth, postMealOption);
router.get("/:eventId/meal-options", requireAuth, getMealOptions);
router.patch(
  "/:eventId/meal-options/:mealOptionId",
  requireAuth,
  patchMealOption,
);
router.patch("/:eventId/details", requireAuth, patchEventDetails);
router.patch("/:eventId/sales", requireAuth, patchEventSales);
router.post("/:eventId/publish", requireAuth, postPublishEvent);
router.post("/:eventId/cancel", requireAuth, postCancelEvent);

export default router;
