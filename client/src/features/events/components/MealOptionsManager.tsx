import type { SubmitEvent } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { Card } from "../../../components/ui/Layout";
import { Input, Textarea } from "../../../components/ui/Fields";
import type { ManagedMealOption } from "../api";
import { useMealOptions, useUpdateMealOption } from "../hooks";
import CreateMealOptionForm from "./CreateMealOptionForm";

export default function MealOptionsManager({
  eventId,
  locked,
}: {
  eventId: string;
  locked: boolean;
}) {
  const query = useMealOptions(eventId);
  return (
    <Card as="section" aria-labelledby="meal-options-heading">
      <h2 id="meal-options-heading">Meal options</h2>
      {locked && (
        <p className="text-muted">Meal options can no longer be changed.</p>
      )}
      {query.isPending ? (
        <p role="status">Loading meals...</p>
      ) : query.error ? (
        <p role="alert">{query.error.message}</p>
      ) : (
        <div className="mb-5 grid gap-3">
          {query.data.length === 0 && (
            <p className="text-muted">No meal options yet.</p>
          )}
          {query.data.map((meal) => (
            <MealEditor
              key={meal.id}
              eventId={eventId}
              meal={meal}
              locked={locked}
            />
          ))}
        </div>
      )}
      {!locked && (
        <div className="border-t border-line pt-5">
          <CreateMealOptionForm eventId={eventId} />
        </div>
      )}
    </Card>
  );
}

function MealEditor({
  eventId,
  meal,
  locked,
}: {
  eventId: string;
  meal: ManagedMealOption;
  locked: boolean;
}) {
  const mutation = useUpdateMealOption(eventId, meal.id);
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || mutation.isPending) return;
    const data = new FormData(event.currentTarget);
    mutation.mutate({
      name: String(data.get("name") ?? ""),
      description: String(data.get("description") ?? ""),
      isAvailable: data.get("isAvailable") === "on",
    });
  }
  return (
    <article className="rounded-md border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="mb-1">{meal.name}</h3>
          <Badge>{meal.isAvailable ? "Available" : "Retired"}</Badge>
          {meal.description && (
            <p className="mt-2 mb-0 whitespace-pre-wrap text-sm text-muted wrap-anywhere">
              {meal.description}
            </p>
          )}
        </div>
        {!locked && (
          <Modal title={`Edit meal: ${meal.name}`} triggerLabel="Edit">
            <h2>Edit meal option</h2>
            <p className="text-sm text-muted">
              Guests who chose this meal will see your changes.
            </p>
            <form onSubmit={submit} onChange={() => mutation.reset()}>
              <fieldset disabled={locked || mutation.isPending}>
                <div className="mb-4">
                  <label htmlFor={`meal-name-${meal.id}`}>Meal name</label>
                  <Input
                    id={`meal-name-${meal.id}`}
                    name="name"
                    defaultValue={meal.name}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor={`meal-description-${meal.id}`}>
                    Description
                  </label>
                  <Textarea
                    id={`meal-description-${meal.id}`}
                    name="description"
                    defaultValue={meal.description ?? ""}
                    maxLength={1000}
                  />
                </div>
                <label className="mb-1 flex items-center gap-2">
                  <Input
                    type="checkbox"
                    name="isAvailable"
                    defaultChecked={meal.isAvailable}
                    aria-describedby={`meal-availability-help-${meal.id}`}
                  />
                  Available for new selections
                </label>
                <p
                  id={`meal-availability-help-${meal.id}`}
                  className="mb-4 text-xs text-muted"
                >
                  Uncheck to stop new selections. Existing choices stay.
                </p>
                {!locked && (
                  <Button className="mt-2.5" type="submit">
                    {mutation.isPending ? "Saving..." : "Save changes"}
                  </Button>
                )}
              </fieldset>
              {mutation.error && <p role="alert">{mutation.error.message}</p>}
              {mutation.isSuccess && <p role="status">Meal option saved.</p>}
            </form>
          </Modal>
        )}
      </div>
    </article>
  );
}
