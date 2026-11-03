import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Fields";
import { useEffect, useState } from "react";
import type { SubmitEvent } from "react";
import { useGuestSearch, useRecoverGuestTicket } from "../hooks";
import { useCheckInTicket } from "../../tickets/hooks";

export default function GuestLookup({
  eventId,
  onBusyChange,
}: {
  eventId: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const query = useGuestSearch(eventId, search);
  const recovery = useRecoverGuestTicket(eventId);
  const mutation = useCheckInTicket(eventId, "id");

  useEffect(() => {
    onBusyChange?.(mutation.isPending || recovery.isPending);
    return () => onBusyChange?.(false);
  }, [mutation.isPending, recovery.isPending, onBusyChange]);

  function handleSearch(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = input.trim();
    if (value.length < 2 || mutation.isPending) return;

    mutation.reset();

    if (value === search) {
      void query.refetch();
    } else {
      setSearch(value);
    }
  }

  const result = mutation.isSuccess ? mutation.data : null;

  return (
    <section aria-labelledby="guest-lookup-heading">
      <h2 id="guest-lookup-heading">Manual guest lookup</h2>

      <p className="text-muted">
        Search by name or full booking/ticket reference.
      </p>

      <form className="mb-5 max-w-none" onSubmit={handleSearch}>
        <label htmlFor="guest-search">Search</label>
        <Input
          id="guest-search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          minLength={2}
          maxLength={200}
          required
          disabled={mutation.isPending}
        />
        <Button
          className="mt-2.5"
          type="submit"
          disabled={mutation.isPending || query.isFetching}
        >
          Search
        </Button>
      </form>

      {recovery.error && <p role="alert">{recovery.error.message}</p>}
      {mutation.isPending && <p role="status">Checking in...</p>}

      {mutation.error && (
        <p role="alert">
          Check-in status is uncertain. Refresh the search before admitting this
          guest. {mutation.error.message}
        </p>
      )}

      {result && (
        <div role="status">
          {result.status === "checked_in" ? (
            <p>
              <strong>Admitted:</strong>{" "}
              {result.ticket.fullName || `Guest ${result.ticket.position}`} —
              ticket {result.ticket.id}
            </p>
          ) : result.status === "already_checked_in" ? (
            <p>
              <strong>Already used — do not admit again.</strong> Previous
              check-in: {new Date(result.checkedInAt).toLocaleString("en-GB")}
            </p>
          ) : (
            <p>
              <strong>Not admitted:</strong> {result.error}
            </p>
          )}
        </div>
      )}

      {search && (
        <>
          <p>Results for: {search}</p>

          {query.isPending ? (
            <p>Searching...</p>
          ) : query.error ? (
            <p role="alert">{query.error.message}</p>
          ) : query.data?.guests.length === 0 ? (
            <p>No matching confirmed guests.</p>
          ) : (
            <ul className="list-none divide-y divide-line pl-0">
              {query.data?.guests.map((guest) => {
                const ticket = guest.ticket;

                return (
                  <li key={guest.id} className="py-4 wrap-anywhere">
                    <strong>
                      {guest.fullName || `Guest ${guest.position}`}
                    </strong>
                    {" — "}
                    {guest.tier === "VIP" ? "VIP" : "Standard"}

                    <p className="mt-2 mb-1 text-xs text-muted">
                      Booking: {guest.bookingId}
                    </p>
                    {ticket && (
                      <p className="text-xs text-muted">
                        Ticket reference: {ticket.id}
                      </p>
                    )}

                    {!ticket ? (
                      <Button
                        disabled={
                          recovery.isPending ||
                          mutation.isPending ||
                          query.isFetching
                        }
                        onClick={() => recovery.mutate(guest.id)}
                      >
                        Prepare missing ticket
                      </Button>
                    ) : ticket.revokedAt ? (
                      <p>Ticket blocked.</p>
                    ) : ticket.checkedInAt ? (
                      <p>
                        Checked in:{" "}
                        {new Date(ticket.checkedInAt).toLocaleString("en-GB")}
                      </p>
                    ) : (
                      <Button
                        type="button"
                        disabled={mutation.isPending || query.isFetching}
                        onClick={() => mutation.mutate(ticket.id)}
                      >
                        Admit this guest
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {query.data?.hasMore && (
            <p>Too many matches. Try a more specific search.</p>
          )}
        </>
      )}
    </section>
  );
}
