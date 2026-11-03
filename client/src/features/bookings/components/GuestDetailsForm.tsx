import { Button } from "../../../components/ui/Button";
import { Input, Select, Textarea } from "../../../components/ui/Fields";
import { useState, type SubmitEvent } from "react";
import type { BookingGuest } from "../api";
import { useBookingGuests, useUpdateBookingGuest } from "../hooks";

type Props = {
  bookingId: string;
  guest: BookingGuest;
  canEdit: boolean;
  canEditCatering: boolean;
  mealRequired: boolean;
  mealOptions: {
    id: string;
    name: string;
    description: string | null;
  }[];
};

export default function GuestDetailsForm({
  bookingId,
  guest,
  canEdit,
  canEditCatering,
  mealRequired,
  mealOptions,
}: Props) {
  const query = useBookingGuests(bookingId);
  const [version, setVersion] = useState(guest.updatedAt);
  const [reloadKey, setReloadKey] = useState(0);
  const { mutate, isPending, error, isSuccess, reset } = useUpdateBookingGuest(
    bookingId,
    guest.id,
  );

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit || isPending) return;

    const data = new FormData(event.currentTarget);
    const mealOptionId = String(data.get("mealOptionId") ?? "");
    mutate(
      {
        expectedUpdatedAt: version,
        fullName: String(data.get("fullName") ?? ""),
        dietaryRequirements: canEditCatering
          ? String(data.get("dietaryRequirements") ?? "")
          : (guest.dietaryRequirements ?? ""),
        accessibilityNeeds: String(data.get("accessibilityNeeds") ?? ""),
        mealOptionId: canEditCatering
          ? mealOptionId || null
          : guest.mealOptionId,
      },
      { onSuccess: (result) => setVersion(result.updatedAt) },
    );
  }

  return (
    <form key={reloadKey} onSubmit={handleSubmit} onChange={() => reset()}>
      <fieldset disabled={isPending || !canEdit}>
        <legend>Guest {guest.position}</legend>

        <div className="mb-4">
          <label htmlFor={`name-${guest.id}`}>Full name</label>
          <Input
            id={`name-${guest.id}`}
            name="fullName"
            defaultValue={guest.fullName ?? ""}
            maxLength={200}
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor={`meal-${guest.id}`}>Meal choice</label>

          <Select
            id={`meal-${guest.id}`}
            name="mealOptionId"
            disabled={!canEditCatering}
            required={mealRequired}
            defaultValue={guest.mealOptionId ?? ""}
          >
            <option value="">No meal selected</option>

            {guest.mealOption &&
              !mealOptions.some(
                (option) => option.id === guest.mealOptionId,
              ) && (
                <option value={guest.mealOption.id}>
                  {guest.mealOption.name} — existing selection
                </option>
              )}

            {mealOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>

          {mealOptions.length === 0 && (
            <p className="text-sm">No meals available to choose.</p>
          )}
        </div>

        <div className="mb-4">
          <label htmlFor={`diet-${guest.id}`}>
            Dietary requirements or allergies
          </label>
          <Textarea
            id={`diet-${guest.id}`}
            name="dietaryRequirements"
            disabled={!canEditCatering}
            defaultValue={guest.dietaryRequirements ?? ""}
            maxLength={2000}
          />
        </div>

        <div className="mb-4">
          <label htmlFor={`access-${guest.id}`}>Accessibility needs</label>
          <Textarea
            id={`access-${guest.id}`}
            name="accessibilityNeeds"
            defaultValue={guest.accessibilityNeeds ?? ""}
            maxLength={2000}
          />
        </div>

        {canEdit && (
          <Button className="mt-2.5" type="submit">
            {isPending ? "Saving..." : "Save guest"}
          </Button>
        )}
      </fieldset>

      {error && (
        <>
          <p role="alert">{error.message}</p>
          <Button
            className="mt-2.5"
            variant="secondary"
            type="button"
            disabled={isPending || query.isFetching}
            onClick={async () => {
              const latest = await query.refetch();
              const current = latest.data?.items
                .flatMap((item) => item.guests)
                .find((item) => item.id === guest.id);
              if (current && !latest.error) {
                setVersion(current.updatedAt);
                setReloadKey((key) => key + 1);
                reset();
              }
            }}
          >
            Discard edits and reload
          </Button>
        </>
      )}
      {isSuccess && <p role="status">Guest details saved.</p>}
    </form>
  );
}
