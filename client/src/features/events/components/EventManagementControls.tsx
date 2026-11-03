import { toLocalDateTime } from "../../../lib/format";
import { Button } from "../../../components/ui/Button";
import { Input, Textarea } from "../../../components/ui/Fields";
import { useNow } from "../../../lib/useNow";
import { useState } from "react";
import type { SubmitEvent } from "react";
import type { EventDetails } from "../api";
import { useEvent, useUpdateEventSettings } from "../hooks";
import EventCateringFields from "./EventCateringFields";
import EventBrandingFields from "./EventBrandingFields";

export default function EventManagementControls({
  event,
}: {
  event: EventDetails;
}) {
  const now = useNow();
  const mutation = useUpdateEventSettings(event.id);
  const query = useEvent(event.id);
  const [editing, setEditing] = useState<EventDetails | null>(null);

  const canEdit = new Date(event.startsAt).getTime() > now;

  function handleSubmit(submitEvent: SubmitEvent<HTMLFormElement>) {
    submitEvent.preventDefault();

    if (!editing || !canEdit || mutation.isPending) return;

    const form = new FormData(submitEvent.currentTarget);
    const description = String(form.get("description") ?? "").trim();
    const start = String(form.get("startsAt"));

    mutation.mutate(
      {
        kind: "details",
        input: {
          expectedUpdatedAt: editing.updatedAt,
          cateringDeadline: form.get("cateringDeadline")
            ? new Date(String(form.get("cateringDeadline"))).toISOString()
            : null,
          title: String(form.get("title") ?? "").trim(),
          description: description || null,
          venue: String(form.get("venue") ?? "").trim(),
          startsAt:
            start === toLocalDateTime(editing.startsAt)
              ? editing.startsAt
              : new Date(start).toISOString(),
          bannerUrl: String(form.get("bannerUrl") ?? "").trim() || null,
          headingColor: String(form.get("headingColor") ?? "") || null,
        },
      },
      {
        onSuccess: () => setEditing(null),
      },
    );
  }

  return (
    <section aria-labelledby="event-management-heading">
      <h2 id="event-management-heading">Edit details</h2>

      {!canEdit ? (
        <p>This event has started. Editing is locked.</p>
      ) : editing ? (
        <form key={editing.updatedAt} onSubmit={handleSubmit}>
          <fieldset disabled={mutation.isPending}>
            <legend>Edit event details</legend>

            <div className="mb-4">
              <label htmlFor="edit-event-title">Title</label>
              <Input
                id="edit-event-title"
                name="title"
                defaultValue={editing.title}
                required
                maxLength={200}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="edit-event-description">Description</label>
              <Textarea
                id="edit-event-description"
                name="description"
                defaultValue={editing.description ?? ""}
                maxLength={5000}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="edit-event-venue">Venue</label>
              <Input
                id="edit-event-venue"
                name="venue"
                defaultValue={editing.venue}
                required
                maxLength={300}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="edit-event-start">
                Start time{" "}
                <span className="text-xs text-muted">Local time</span>
              </label>
              <Input
                id="edit-event-start"
                name="startsAt"
                type="datetime-local"
                defaultValue={toLocalDateTime(editing.startsAt)}
                required
              />
            </div>

            <EventCateringFields deadline={editing.cateringDeadline} />
            <EventBrandingFields
              bannerUrl={editing.bannerUrl}
              headingColor={editing.headingColor}
            />

            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button type="submit">Save details</Button>

              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setEditing(null);
                  mutation.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </fieldset>
        </form>
      ) : (
        <Button
          variant="secondary"
          type="button"
          disabled={mutation.isPending}
          onClick={() => {
            mutation.reset();
            setEditing(event);
          }}
        >
          Edit event details
        </Button>
      )}

      {mutation.isPending && <p role="status">Saving...</p>}

      {mutation.error && (
        <>
          <p role="alert">{mutation.error.message}</p>
          {editing && (
            <Button
              variant="secondary"
              type="button"
              disabled={query.isFetching}
              onClick={async () => {
                const latest = await query.refetch();
                if (latest.data && !latest.error) {
                  setEditing(latest.data);
                  mutation.reset();
                }
              }}
            >
              Discard edits and reload
            </Button>
          )}
        </>
      )}

      {mutation.isSuccess && <p role="status">Event updated.</p>}
    </section>
  );
}
