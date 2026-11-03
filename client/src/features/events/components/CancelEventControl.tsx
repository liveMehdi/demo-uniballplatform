import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Fields";
import { useState } from "react";
import type { SubmitEvent } from "react";
import { useCancelEvent } from "../hooks";
import { useEmailAvailability } from "../../auth/useEmailAvailability";

export default function CancelEventControl({
  eventId,
  eventTitle,
  cancelledAt,
}: {
  eventId: string;
  eventTitle: string;
  cancelledAt: string | null;
}) {
  const [confirmation, setConfirmation] = useState("");
  const mutation = useCancelEvent(eventId);
  const { data: emailEnabled } = useEmailAvailability();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (confirmation !== "CANCEL" || mutation.isPending) return;
    mutation.mutate();
  }

  if (cancelledAt) {
    return (
      <p>Event cancelled on {new Date(cancelledAt).toLocaleString("en-GB")}.</p>
    );
  }

  return (
    <section aria-labelledby="cancel-event-heading">
      <h2 id="cancel-event-heading">Cancel event</h2>

      <p>
        Cancelling <strong className="font-serif">{eventTitle}</strong> will
        cancel pending and confirmed bookings, block tickets and hide seating.
        This cannot be undone.
      </p>

      {emailEnabled && <p>Cancellation emails will be queued.</p>}

      <form onSubmit={handleSubmit}>
        <fieldset disabled={mutation.isPending}>
          <legend>Confirm cancellation</legend>

          <label htmlFor="cancel-event-confirmation">Type CANCEL</label>
          <Input
            id="cancel-event-confirmation"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              mutation.reset();
            }}
            autoComplete="off"
            required
          />

          <Button
            variant="danger"
            className="mt-2.5"
            type="submit"
            disabled={confirmation !== "CANCEL"}
          >
            {mutation.isPending ? "Cancelling..." : "Cancel this event"}
          </Button>
        </fieldset>
      </form>

      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </section>
  );
}
