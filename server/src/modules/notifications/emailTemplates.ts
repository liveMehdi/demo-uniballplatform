import "dotenv/config";
import { appOrigin } from "../../lib/emailConfig.js";

function appLink(path: string) {
  return new URL(path, appOrigin()).toString();
}

function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function subjectText(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function buildTicketsEmail(input: {
  name: string;
  eventTitle: string;
  venue: string;
  startsAt: Date;
  bookingId: string;
  simulated?: boolean;
}) {
  const ticketsUrl = appLink(
    `/bookings/${encodeURIComponent(input.bookingId)}/tickets`,
  );

  const guestsUrl = appLink(
    `/bookings/${encodeURIComponent(input.bookingId)}/guests`,
  );

  return {
    subject: `Your tickets: ${subjectText(input.eventTitle)}`,
    text: [
      `Hi ${input.name || "there"},`,
      "",
      `Your booking for ${input.eventTitle} is confirmed.`,
      ...(input.simulated
        ? ["This was a demo checkout. No money was charged."]
        : []),
      "",
      `Venue: ${input.venue}`,
      `Date: ${formatEventDate(input.startsAt)} (UK time)`,
      `Booking reference: ${input.bookingId}`,
      "",
      "View your tickets:",
      ticketsUrl,
      "",
      "Sign in with the account used for this booking, then select Show tickets.",
      "Each guest has a separate admission QR code.",
      "",
      "Manage guest details and view published seating:",
      guestsUrl,
      "",
      "University Events",
    ].join("\n"),
  };
}

export function buildAuthEmail(input: {
  kind: "password_reset" | "email_verification";
  name: string;
  url: string;
}) {
  const reset = input.kind === "password_reset";
  return {
    subject: reset
      ? "Reset your University Events password"
      : "Verify your University Events email",
    text: [
      `Hi ${input.name || "there"},`,
      "",
      reset
        ? "Use this link to choose a new password:"
        : "Use this link to verify your email address:",
      input.url,
      "",
      "This link expires after one hour.",
      reset
        ? "If you did not request this, you can ignore this email. Your password will stay unchanged."
        : "If you did not create this account, you can ignore this email.",
      "",
      "University Events",
    ].join("\n"),
  };
}

export function buildEventCancelledEmail(input: {
  name: string;
  eventTitle: string;
  bookingId: string;
}) {
  return {
    subject: `Event cancelled: ${subjectText(input.eventTitle)}`,
    text: [
      `Hi ${input.name || "there"},`,
      "",
      `${input.eventTitle} has been cancelled.`,
      "",
      `Booking reference: ${input.bookingId}`,
      "",
      "Your booking has been cancelled and its admission tickets are no longer valid.",
      "Contact the event organiser if you have questions.",
      "",
      "View your bookings:",
      appLink("/bookings"),
      "",
      "University Events",
    ].join("\n"),
  };
}
