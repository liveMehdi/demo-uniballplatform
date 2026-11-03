import LoginLink from "../../features/auth/components/LoginLink";
import { Button } from "../../components/ui/Button";
import { Card, Page } from "../../components/ui/Layout";
import { Badge } from "../../components/ui/Badge";
import { Link, useParams } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import { authClient } from "../../lib/auth-client";
import { useEmailAvailability } from "../../features/auth/useEmailAvailability";
import {
  usePrepareBookingTickets,
  useRequestTicketEmail,
} from "../../features/tickets/hooks";

export default function BookingTicketsPage() {
  const { bookingId } = useParams();

  const {
    data: session,
    isPending: checkingSession,
    error: sessionError,
  } = authClient.useSession();

  if (!bookingId)
    return (
      <Page>
        <p role="alert">Missing booking ID.</p>
      </Page>
    );

  if (checkingSession)
    return (
      <Page>
        <p role="status">Checking session...</p>
      </Page>
    );

  if (sessionError) {
    return (
      <Page>
        <p role="alert">Could not check your session.</p>
      </Page>
    );
  }

  if (!session) {
    return (
      <Page>
        <p>
          <LoginLink>Log in</LoginLink> to view your tickets.
        </p>
      </Page>
    );
  }

  return (
    <BookingTicketsContent
      key={`${session.user.id}-${bookingId}`}
      bookingId={bookingId}
    />
  );
}

function BookingTicketsContent({ bookingId }: { bookingId: string }) {
  const { data: emailEnabled } = useEmailAvailability();
  const emailMutation = useRequestTicketEmail(bookingId);
  const mutation = usePrepareBookingTickets(bookingId);
  const data = mutation.data;

  return (
    <Page className="max-w-4xl">
      <Link className="text-sm no-underline" to="/bookings">
        ← Back to my bookings
      </Link>

      <header className="mt-5 mb-6 border-b border-line pb-6">
        <h1>Your tickets</h1>

        <p className="text-muted">
          One ticket per guest. Keep QR codes private.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? "Loading tickets..."
            : mutation.isSuccess
              ? "Refresh tickets"
              : "Show tickets"}
        </Button>
        {emailEnabled && <Button
          variant="secondary"
          type="button"
          disabled={emailMutation.isPending}
          onClick={() => emailMutation.mutate()}
        >
          {emailMutation.isPending ? "Requesting..." : "Email my tickets"}
        </Button>}
      </div>

      {emailEnabled && emailMutation.isSuccess && <p role="status">Ticket email queued.</p>}

      {emailEnabled && emailMutation.error && <p role="alert">{emailMutation.error.message}</p>}

      {mutation.error && <p role="alert">{mutation.error.message}</p>}

      {mutation.isSuccess && data && (
        <>
          <Card
            as="section"
            className="my-6"
            aria-labelledby="ticket-event-heading"
          >
            <h2 id="ticket-event-heading">{data.event.title}</h2>
            <p className="mb-1 text-muted">{data.event.venue}</p>
            <p className="text-muted">
              {new Date(data.event.startsAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <p className="border-t border-line pt-3 text-xs text-muted wrap-anywhere">
              Booking reference: {data.bookingId}
            </p>
          </Card>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
            {data.tickets.map((ticket) => {
              const guestName = ticket.fullName || `Guest ${ticket.position}`;

              return (
                <Card
                  as="article"
                  key={ticket.id}
                  aria-labelledby={`ticket-heading-${ticket.id}`}
                >
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
                    <h2 className="mb-0" id={`ticket-heading-${ticket.id}`}>
                      {guestName}
                    </h2>

                    <Badge>{ticket.tier === "VIP" ? "VIP" : "Standard"}</Badge>
                  </div>

                  {ticket.revokedAt ? (
                    <p>This ticket has been blocked.</p>
                  ) : ticket.checkedInAt ? (
                    <p>
                      Already checked in at{" "}
                      {new Date(ticket.checkedInAt).toLocaleString("en-GB")}.
                    </p>
                  ) : ticket.token ? (
                    <>
                      <QRCodeSVG
                        value={ticket.token}
                        size={240}
                        level="M"
                        marginSize={4}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        title={`Admission QR code for ${guestName}`}
                        className="mx-auto block h-auto max-w-full rounded-md"
                      />

                      <p className="mt-3 text-center text-muted">
                        Present this code at entry.
                      </p>
                    </>
                  ) : (
                    <p>QR code unavailable. Contact the organiser.</p>
                  )}

                  <p className="mt-5 border-t border-line pt-3 text-xs text-muted wrap-anywhere">
                    Ticket reference: {ticket.id}
                  </p>
                </Card>
              );
            })}
          </div>

          <p className="mt-6">
            <Link to={`/bookings/${bookingId}/guests`}>
              Manage guest details and view seating
            </Link>
          </p>
        </>
      )}
    </Page>
  );
}
