import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  getOrganisedSocieties,
  getSocietyOrganisers,
  postSocietyOrganiser,
  deleteSocietyOrganiser,
} from "./societies.controller.js";

const router = Router();

router.get("/organised", requireAuth, getOrganisedSocieties);
router.get("/:societyId/organisers", requireAuth, getSocietyOrganisers);
router.post("/:societyId/organisers", requireAuth, postSocietyOrganiser);
router.delete(
  "/:societyId/organisers/:userId",
  requireAuth,
  deleteSocietyOrganiser,
);

export default router;
