import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Fields";
import type { SubmitEvent } from "react";
import { useUpdateEventCapacity } from "../hooks";

type Props = {
  eventId: string;
  capacity: number | null;
};

export default function EventCapacityForm({ eventId, capacity }: Props) {
  const { mutate, isPending, error, isSuccess, reset } =
    useUpdateEventCapacity(eventId);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    mutate(Number(formData.get("capacity")));
  }

  return (
    <section aria-labelledby="capacity-heading">
      <h2 id="capacity-heading">Event capacity</h2>

      <form onSubmit={handleSubmit}>
        <fieldset disabled={isPending}>
          <label htmlFor="edit-event-capacity">Maximum attendees</label>

          <Input
            key={capacity ?? "unset"}
            id="edit-event-capacity"
            name="capacity"
            type="number"
            min="1"
            max="2147483647"
            step="1"
            defaultValue={capacity ?? ""}
            onChange={() => reset()}
            required
          />

          <Button className="mt-2.5" type="submit">
            {isPending ? "Saving..." : "Save capacity"}
          </Button>
        </fieldset>

        <p className="text-sm">Includes Standard and VIP.</p>

        {error && <p role="alert">{error.message}</p>}
        {isSuccess && <p role="status">Capacity updated.</p>}
      </form>
    </section>
  );
}
