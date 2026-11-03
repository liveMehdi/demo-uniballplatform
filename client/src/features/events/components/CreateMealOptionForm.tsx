import { Button } from "../../../components/ui/Button";
import { Input, Textarea } from "../../../components/ui/Fields";
import type { SubmitEvent } from "react";
import { useCreateMealOption } from "../hooks";

export default function CreateMealOptionForm({ eventId }: { eventId: string }) {
  const { mutate, isPending, error, isSuccess, reset } =
    useCreateMealOption(eventId);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    mutate(
      {
        name: String(data.get("name") ?? ""),
        description: String(data.get("description") ?? ""),
      },
      {
        onSuccess: () => form.reset(),
      },
    );
  }

  return (
    <section aria-labelledby="add-meal-heading">
      <h2 id="add-meal-heading">Add meal option</h2>

      <form onSubmit={handleSubmit} onChange={() => reset()}>
        <fieldset disabled={isPending}>
          <div className="mb-4">
            <label htmlFor="meal-name">Meal name</label>
            <Input id="meal-name" name="name" maxLength={100} required />
          </div>

          <div className="mb-4">
            <label htmlFor="meal-description">Description</label>
            <Textarea
              id="meal-description"
              name="description"
              maxLength={1000}
            />
          </div>

          <Button className="mt-2.5" type="submit">
            {isPending ? "Adding..." : "Add meal option"}
          </Button>
        </fieldset>

        {error && <p role="alert">{error.message}</p>}
        {isSuccess && <p role="status">Meal option added.</p>}
      </form>
    </section>
  );
}
