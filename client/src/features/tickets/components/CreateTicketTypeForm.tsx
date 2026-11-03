import { Button } from "../../../components/ui/Button";
import { Input, Select } from "../../../components/ui/Fields";
import type { SubmitEvent } from "react";
import { useCreateTicketType } from "../hooks";

type Props = {
  eventId: string;
};

export default function CreateTicketTypeForm({ eventId }: Props) {
  const { mutate, isPending, error, isSuccess } = useCreateTicketType(eventId);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const tier = data.get("tier");

    if (tier !== "STANDARD" && tier !== "VIP") return;

    mutate(
      {
        tier,
        pricePence: Number(data.get("pricePence")),
        capacity: Number(data.get("capacity")),
        salesStart: new Date(String(data.get("salesStart"))).toISOString(),
        salesEnd: new Date(String(data.get("salesEnd"))).toISOString(),
      },
      {
        onSuccess: () => form.reset(),
      },
    );
  }

  return (
    <section aria-labelledby="create-ticket-heading">
      <h2 id="create-ticket-heading">Add ticket option</h2>

      <form onSubmit={handleSubmit}>
        <fieldset disabled={isPending}>
          <div className="mb-4">
            <label htmlFor="ticket-tier">Tier</label>
            <Select
              id="ticket-tier"
              name="tier"
              defaultValue="STANDARD"
              required
            >
              <option value="STANDARD">Standard</option>
              <option value="VIP">VIP</option>
            </Select>
          </div>

          <div className="mb-4">
            <label htmlFor="ticket-price">Price in pence (£45 = 4500)</label>
            <Input
              id="ticket-price"
              name="pricePence"
              type="number"
              min="0"
              max="2147483647"
              step="1"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="ticket-capacity">Number of tickets</label>
            <Input
              id="ticket-capacity"
              name="capacity"
              type="number"
              min="1"
              max="2147483647"
              step="1"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="ticket-sales-start">Sales open</label>
            <Input
              id="ticket-sales-start"
              name="salesStart"
              type="datetime-local"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="ticket-sales-end">Sales close</label>
            <Input
              id="ticket-sales-end"
              name="salesEnd"
              type="datetime-local"
              required
            />
          </div>

          <Button className="mt-2.5" type="submit">
            {isPending ? "Creating..." : "Add ticket option"}
          </Button>
        </fieldset>

        {error && <p role="alert">{error.message}</p>}
        {isSuccess && <p role="status">Ticket option created.</p>}
      </form>
    </section>
  );
}
