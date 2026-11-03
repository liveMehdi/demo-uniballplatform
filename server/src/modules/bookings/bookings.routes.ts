import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { postBooking } from "./bookings.controller.js";

const router = Router({ mergeParams: true });

router.post("/", requireAuth, postBooking);

export default router;
