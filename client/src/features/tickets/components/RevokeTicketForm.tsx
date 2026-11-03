import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Fields";
import { useState } from "react";
import type { SubmitEvent } from "react";
import { useManageEventTicket } from "../hooks";

export default function RevokeTicketForm({ eventId }: { eventId: string }) {
  const [ticketId, setTicketId] = useState("");
  const mutation = useManageEventTicket(eventId);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;

    mutation.mutate(
      {
        kind: "revoke",
        ticketId: ticketId.trim(),
      },
      {
        onSuccess: () => setTicketId(""),
      },
    );
  }

  return (
    <section aria-labelledby="revoke-ticket-heading">
      <h2 id="revoke-ticket-heading">Block a ticket</h2>

      <p>
        This ticket will no longer allow entry. The booking and its place are
        kept. This cannot be undone.
      </p>

      <form onSubmit={handleSubmit}>
        <fieldset disabled={mutation.isPending}>
          <legend>Ticket to block</legend>

          <label htmlFor="revoke-ticket-id">Full ticket reference</label>
          <Input
            id="revoke-ticket-id"
            value={ticketId}
            onChange={(event) => {
              setTicketId(event.target.value);
              mutation.reset();
            }}
            required
            autoComplete="off"
          />

          <Button variant="danger" className="mt-2.5" type="submit">
            {mutation.isPending ? "Blocking..." : "Block ticket"}
          </Button>
        </fieldset>
      </form>

      {mutation.error && <p role="alert">{mutation.error.message}</p>}

      {mutation.isSuccess && <p role="status">Ticket blocked.</p>}
    </section>
  );
}
