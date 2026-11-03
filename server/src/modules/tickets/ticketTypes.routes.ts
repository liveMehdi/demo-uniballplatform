import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { postTicketType } from "./ticketTypes.controller.js";

const router = Router({ mergeParams: true });

router.post("/", requireAuth, postTicketType);

export default router;
