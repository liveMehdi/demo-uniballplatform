import LoginLink from "../../features/auth/components/LoginLink";
import { Input } from "../../components/ui/Fields";
import { Button, LinkButton } from "../../components/ui/Button";
import { Card, Page } from "../../components/ui/Layout";
import { useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { Link, useParams } from "react-router";
import { authClient } from "../../lib/auth-client";
import { useCheckInTicket } from "../../features/tickets/hooks";
import TicketCameraScanner from "../../features/tickets/components/TicketCameraScanner";
import AttendanceSummary from "../../features/scanner/components/AttendanceSummary";
import GuestLookup from "../../features/scanner/components/GuestLookup";
import { useAttendance } from "../../features/scanner/hooks";

export default function EventCheckInPage() {
  const { eventId } = useParams();

  const {
    data: session,
    isPending: checkingSession,
    error: sessionError,
  } = authClient.useSession();

  if (!eventId)
    return (
      <Page>
        <p role="alert">Missing event ID.</p>
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
          <LoginLink>Log in</LoginLink> to check in guests.
        </p>
      </Page>
    );
  }

  return (
    <EventCheckIn key={`${session.user.id}-${eventId}`} eventId={eventId} />
  );
}

function EventCheckIn({ eventId }: { eventId: string }) {
  const access = useAttendance(eventId);
  const mutation = useCheckInTicket(eventId);
  const [token, setToken] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const requestInFlight = useRef(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mode, setMode] = useState<"scan" | "lookup">("scan");
  const modeRef = useRef(mode);
  const [lookupBusy, setLookupBusy] = useState(false);

  function changeMode(next: "scan" | "lookup") {
    if (requestInFlight.current || lookupBusy || next === mode) return;
    modeRef.current = next;
    setMode(next);
    setCameraEnabled(false);
    setCameraError(null);
    mutation.reset();
  }

  function submitToken(rawToken: string) {
    const value = rawToken.trim();

    if (!value || requestInFlight.current || modeRef.current !== "scan") return;

    setCameraEnabled(false);
    setCameraError(null);

    if (!/^[a-f0-9]{64}$/.test(value)) {
      mutation.reset();
      setCameraError("This is not a valid ticket code.");
      return;
    }

    requestInFlight.current = true;

    setToken(value);

    mutation.mutate(value, {
      onSuccess: () => {
        setToken("");
      },
      onSettled: () => {
        requestInFlight.current = false;
        inputRef.current?.focus();
      },
    });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    submitToken(token);
  }

  function startCamera() {
    if (requestInFlight.current) return;

    mutation.reset();
    setCameraError(null);
    setToken("");
    setCameraEnabled(true);
  }

  const result = mutation.isSuccess ? mutation.data : null;

  if (access.isPending)
    return (
      <Page>
        <p role="status">Checking access...</p>
      </Page>
    );
  if (access.error) {
    return (
      <Page>
        <p role="alert">{access.error.message}</p>
        <LinkButton to="/scanner">Back to check-in dashboard</LinkButton>
      </Page>
    );
  }

  return (
    <Page className="max-w-4xl">
      <Link className="text-sm no-underline" to="/scanner">
        ← Back to check-in dashboard
      </Link>
      <header className="mt-5 mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <h1 className="mb-0">Guest check-in</h1>
        <LinkButton to={`/events/${eventId}`}>View this event</LinkButton>
      </header>
      <Card className="mb-6 [&_dd]:font-medium [&_dd]:text-ink [&_dd]:tabular-nums [&_p:not([role])]:text-muted">
        <AttendanceSummary eventId={eventId} />
      </Card>

      <div
        role="group"
        aria-label="Check-in method"
        className="mb-5 flex flex-wrap gap-2"
      >
        <Button
          type="button"
          variant={mode === "scan" ? "primary" : "secondary"}
          aria-pressed={mode === "scan"}
          aria-controls="scan-panel"
          disabled={mutation.isPending || lookupBusy}
          onClick={() => changeMode("scan")}
        >
          Scan ticket
        </Button>
        <Button
          type="button"
          variant={mode === "lookup" ? "primary" : "secondary"}
          aria-pressed={mode === "lookup"}
          aria-controls="lookup-panel"
          disabled={mutation.isPending || lookupBusy}
          onClick={() => changeMode("lookup")}
        >
          Find guest
        </Button>
      </div>

      <div id="scan-panel" hidden={mode !== "scan"}>
        <p className="text-muted">Scan a QR code or enter its code below.</p>
        <Card
          as="section"
          className="my-6"
          aria-labelledby="camera-scanner-heading"
        >
          <h2 id="camera-scanner-heading">Camera scanner</h2>

          {cameraEnabled ? (
            <>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setCameraEnabled(false)}
              >
                Stop camera
              </Button>

              <TicketCameraScanner
                onDetected={submitToken}
                onFailure={(message) => {
                  setCameraEnabled(false);
                  setCameraError(message);
                }}
              />
            </>
          ) : (
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={startCamera}
            >
              Scan with camera
            </Button>
          )}

          {cameraError && <p role="alert">{cameraError}</p>}
        </Card>

        <form
          className="max-w-none rounded-md border border-line bg-surface p-5"
          onSubmit={handleSubmit}
        >
          <h2>Enter a ticket code</h2>
          <label htmlFor="check-in-token">Ticket code</label>

          <Input
            ref={inputRef}
            id="check-in-token"
            value={token}
            onChange={(event) => {
              setToken(event.target.value);
              setCameraError(null);
              mutation.reset();
            }}
            readOnly={mutation.isPending || cameraEnabled}
            required
            pattern="[a-f0-9]{64}"
            minLength={64}
            maxLength={64}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="check-in-help"
            className="block"
          />

          <p className="mt-2 text-sm text-muted" id="check-in-help">
            Enter the QR code’s value, not the ticket reference.
          </p>

          <Button
            className="mt-2.5"
            type="submit"
            disabled={mutation.isPending || cameraEnabled || !token.trim()}
          >
            {mutation.isPending ? "Checking..." : "Check in"}
          </Button>
        </form>

        <div aria-live="polite" aria-atomic="true">
          {mutation.isPending && (
            <p className="mt-4 text-muted">Checking ticket…</p>
          )}

          {result?.status === "checked_in" && (
            <section className="mt-4 rounded-md border border-emerald-400/50 bg-emerald-400/10 p-5">
              <h2>Admitted</h2>

              <p>
                {result.ticket.fullName || `Guest ${result.ticket.position}`}
              </p>

              <p>{result.ticket.tier === "VIP" ? "VIP" : "Standard"}</p>

              <p>
                Checked in:{" "}
                {new Date(result.ticket.checkedInAt).toLocaleString("en-GB")}
              </p>

              <p className="text-xs text-muted wrap-anywhere">
                Ticket reference: {result.ticket.id}
              </p>
            </section>
          )}

          {result?.status === "already_checked_in" && (
            <section className="mt-4 rounded-md border border-amber-400/50 bg-amber-400/10 p-5">
              <h2>Already used — do not admit again</h2>
              <p>{result.error}</p>
              <p>
                Previous check-in:{" "}
                {new Date(result.checkedInAt).toLocaleString("en-GB")}
              </p>
            </section>
          )}

          {(result?.status === "invalid" || result?.status === "conflict") && (
            <section className="mt-4 rounded-md border border-red-400/50 bg-red-400/10 p-5">
              <h2>Not admitted</h2>
              <p>{result.error}</p>
            </section>
          )}
        </div>

        {mutation.error && (
          <div role="alert">
            <h2>Check-in status is uncertain</h2>
            <p>{mutation.error.message}</p>
            <p>
              Retry to check whether the ticket was used before admitting this
              guest.
            </p>
          </div>
        )}
      </div>
      <div id="lookup-panel" hidden={mode !== "lookup"}>
        {mode === "lookup" && (
          <Card>
            <GuestLookup eventId={eventId} onBusyChange={setLookupBusy} />
          </Card>
        )}
      </div>
    </Page>
  );
}
