import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  postTableGroup,
  postJoinTableGroup,
  deleteGuestGroup,
  patchSeatingPublication,
} from "./seating.controller.js";
import {
  getEventTables,
  postEventTable,
  patchGuestTable,
  getEventSeating,
  patchGroupTable,
  patchEventTable,
  deleteEventTable,
  getMyBookingSeating,
} from "./eventTables.controller.js";

const router = Router();

router.use(requireAuth);

router.post("/groups", postTableGroup);
router.post("/groups/join", postJoinTableGroup);
router.delete("/guests/:guestId/group", deleteGuestGroup);
router.get("/events/:eventId/tables", getEventTables);
router.post("/events/:eventId/tables", postEventTable);
router.patch("/events/:eventId/guests/:guestId/table", patchGuestTable);
router.get("/events/:eventId/overview", getEventSeating);
router.patch("/events/:eventId/groups/:groupId/table", patchGroupTable);
router.patch("/events/:eventId/tables/:tableId", patchEventTable);
router.delete("/events/:eventId/tables/:tableId", deleteEventTable);
router.patch("/events/:eventId/publication", patchSeatingPublication);
router.get("/bookings/:bookingId", getMyBookingSeating);

export default router;
