import { Button } from "../../../components/ui/Button";
import { useNow } from "../../../lib/useNow";
import type { EventDetails } from "../api";
import { useUpdateEventSettings } from "../hooks";

export default function EventPublicationControl({
  event,
}: {
  event: EventDetails;
}) {
  const mutation = useUpdateEventSettings(event.id);
  const now = useNow();
  if (event.publishedAt || event.cancelledAt) return null;
  return (
    <section>
      <h3>Draft event</h3>
      <p className="text-muted">
        Only your society's organisers can see this event. Add ticket options
        and if a meal is included, meal choices before publishing.
      </p>
      <Button
        disabled={
          mutation.isPending || new Date(event.startsAt).getTime() <= now
        }
        onClick={() => mutation.mutate({ kind: "publish" })}
      >
        {mutation.isPending ? "Publishing..." : "Publish event"}
      </Button>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </section>
  );
}
