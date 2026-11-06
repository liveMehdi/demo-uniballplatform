import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { emailEnabled } from "./lib/emailConfig.js";
import { demoAccount } from "./lib/demoAccount.js";
import { frontendRouter } from "./middleware/frontend.js";
import eventsRouter from "./modules/events/events.routes.js";
import societiesRouter from "./modules/societies/societies.routes.js";
import ticketTypesRouter from "./modules/tickets/ticketTypes.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import bookingsRouter from "./modules/bookings/bookings.routes.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { postTicketEmail } from "./modules/notifications/notifications.controller.js";
import {
  postManualCheckIn,
  postCheckIn,
} from "./modules/tickets/checkIn.controller.js";
import {
  getMyBookings,
  postConfirmBooking,
  postDemoCheckout,
  postCancelBooking,
  getEventBookings,
  getBookingGuestDetails,
  patchBookingGuest,
  getEventGuests,
  downloadCateringCsv,
} from "./modules/bookings/bookings.controller.js";
import { getOrganiserEvents } from "./modules/events/events.controller.js";
import { postBookingTickets } from "./modules/tickets/bookingTickets.controller.js";
import {
  patchTicketType,
  postRevokeTicket,
} from "./modules/tickets/ticketManagement.controller.js";
import {
  getScannerEvents,
  requireScanStaffManager,
  getScanStaff,
  postScanStaff,
  deleteScanStaff,
  requireScannerAccess,
  getAttendance,
  getGuestSearch,
  postRecoverGuestTicket,
} from "./modules/scanner/scanner.controller.js";

import seatingRouter from "./modules/seating/seating.routes.js";

const app = express();

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/api/config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ emailEnabled: emailEnabled(), demoAccount: demoAccount() });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/events", eventsRouter);
app.use("/api/societies", societiesRouter);
app.use("/api/events/:eventId/ticket-types", ticketTypesRouter);
app.use("/api/events/:eventId/bookings", bookingsRouter);
app.get("/api/bookings", requireAuth, getMyBookings);
app.post("/api/bookings/:bookingId/confirm", requireAuth, postConfirmBooking);
app.post(
  "/api/bookings/:bookingId/demo-checkout",
  requireAuth,
  postDemoCheckout,
);
app.post(
  "/api/scanner/events/:eventId/guests/:guestId/ticket",
  requireAuth,
  postRecoverGuestTicket,
);
app.post("/api/bookings/:bookingId/cancel", requireAuth, postCancelBooking);
app.get("/api/events/:eventId/bookings", requireAuth, getEventBookings);
app.get("/api/organiser/events", requireAuth, getOrganiserEvents);
app.get("/api/bookings/:bookingId/guests", requireAuth, getBookingGuestDetails);
app.get("/api/events/:eventId/guests", requireAuth, getEventGuests);
app.use("/api/seating", seatingRouter);
app.get("/api/scanner/events", requireAuth, getScannerEvents);

app.get(
  "/api/events/:eventId/scan-staff",
  requireAuth,
  requireScanStaffManager,
  getScanStaff,
);

app.post(
  "/api/events/:eventId/scan-staff",
  requireAuth,
  requireScanStaffManager,
  postScanStaff,
);

app.delete(
  "/api/events/:eventId/scan-staff/:userId",
  requireAuth,
  requireScanStaffManager,
  deleteScanStaff,
);
app.post("/api/bookings/:bookingId/tickets", requireAuth, postBookingTickets);
app.get(
  "/api/scanner/events/:eventId/attendance",
  requireAuth,
  requireScannerAccess,
  getAttendance,
);

app.get(
  "/api/scanner/events/:eventId/guests",
  requireAuth,
  requireScannerAccess,
  getGuestSearch,
);

app.post(
  "/api/events/:eventId/check-in/manual",
  requireAuth,
  postManualCheckIn,
);
app.post("/api/events/:eventId/check-in", requireAuth, postCheckIn);

app.patch(
  "/api/bookings/:bookingId/guests/:guestId",
  requireAuth,
  patchBookingGuest,
);
app.get(
  "/api/organiser/events/:eventId/catering.csv",
  requireAuth,
  downloadCateringCsv,
);
app.patch(
  "/api/events/:eventId/ticket-types/:ticketTypeId",
  requireAuth,
  patchTicketType,
);

app.post(
  "/api/events/:eventId/tickets/:ticketId/revoke",
  requireAuth,
  postRevokeTicket,
);
app.post(
  "/api/bookings/:bookingId/email-tickets",
  requireAuth,
  postTicketEmail,
);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found." });
});

if (process.env.SERVE_CLIENT === "true") {
  app.use(frontendRouter());
}

app.use(errorHandler);

export default app;
