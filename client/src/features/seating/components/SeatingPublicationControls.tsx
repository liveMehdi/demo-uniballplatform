import { Button } from "../../../components/ui/Button";
import { useSetSeatingPublication } from "../hooks";

type Props = {
  eventId: string;
  publishedAt: string | null;
  canChange: boolean;
};

export default function SeatingPublicationControls({
  eventId,
  publishedAt,
  canChange,
}: Props) {
  const mutation = useSetSeatingPublication(eventId);
  const published = publishedAt !== null;

  return (
    <section aria-labelledby="seating-publication-heading">
      <h2 id="seating-publication-heading">Guest visibility</h2>

      <p>
        {published
          ? "Confirmed guests can see their tables."
          : "Guests can't see seating yet."}
      </p>

      {canChange && (
        <p className="text-muted">
          {published
            ? "Hide seating to edit. Newly confirmed guests without seats also hide it."
            : "Seat all confirmed guests before sharing seating."}
        </p>
      )}

      <Button
        type="button"
        disabled={!canChange || mutation.isPending}
        onClick={() => mutation.mutate(!published)}
      >
        {mutation.isPending
          ? "Updating..."
          : published
            ? "Hide seating"
            : "Share seating"}
      </Button>

      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </section>
  );
}
