import LoginLink from "../../auth/components/LoginLink";
import { Button } from "../../../components/ui/Button";
import { Input, Select, Textarea } from "../../../components/ui/Fields";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { useCreateEvent } from "../hooks";
import { authClient } from "../../../lib/auth-client";
import { useOrganisedSocieties } from "../../societies/hooks";
import EventCateringFields from "./EventCateringFields";
import EventBrandingFields from "./EventBrandingFields";

export default function CreateEventForm() {
  const navigate = useNavigate();
  const { mutate, isPending: saving, error } = useCreateEvent();
  const {
    data: session,
    isPending: checkingSession,
    error: sessionError,
  } = authClient.useSession();

  const {
    data: societies = [],
    isPending: loadingSocieties,
    error: societiesError,
  } = useOrganisedSocieties();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    mutate(
      {
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        venue: String(formData.get("venue") ?? ""),
        startsAt: new Date(String(formData.get("startsAt"))).toISOString(),
        cateringDeadline: formData.get("cateringDeadline")
          ? new Date(String(formData.get("cateringDeadline"))).toISOString()
          : null,
        societyId: String(formData.get("societyId") ?? ""),
        capacity: Number(formData.get("capacity")),
        bannerUrl: String(formData.get("bannerUrl") ?? "").trim() || null,
        headingColor: String(formData.get("headingColor") ?? "") || null,
      },
      {
        onSuccess: (created) =>
          navigate(`/organiser/events/${created.id}/tickets`, {
            replace: true,
          }),
      },
    );
  }

  if (checkingSession) {
    return <p>Checking session...</p>;
  }

  if (sessionError) {
    return <p role="alert">Could not check your session.</p>;
  }

  if (!session) {
    return (
      <p>
        <LoginLink>Log in</LoginLink> to create an event.
      </p>
    );
  }

  if (loadingSocieties) {
    return <p>Loading your societies...</p>;
  }

  if (societiesError) {
    return <p role="alert">{societiesError.message}</p>;
  }

  if (societies.length === 0) {
    return <p>You don’t currently organise any societies.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create an event</h2>
      <p className="text-muted">Saved as a private draft until published.</p>

      <fieldset disabled={saving}>
        <div className="mb-4">
          <label htmlFor="title">Title</label>
          <Input id="title" name="title" required maxLength={200} />
        </div>

        <div className="mb-4">
          <label htmlFor="description">Description</label>
          <Textarea id="description" name="description" maxLength={5000} />
        </div>

        <div className="mb-4">
          <label htmlFor="venue">Venue</label>
          <Input id="venue" name="venue" required maxLength={300} />
        </div>
        <div className="mb-4">
          <label htmlFor="event-capacity">Event capacity</label>
          <Input
            id="event-capacity"
            name="capacity"
            type="number"
            min="1"
            max="1000"
            step="1"
            required
            aria-describedby="event-capacity-help"
          />
          <p className="text-sm" id="event-capacity-help">
            Maximum attendees across Standard and VIP tickets combined.
          </p>
        </div>
        <div className="mb-4">
          <label htmlFor="startsAt">Date and time</label>
          <Input id="startsAt" name="startsAt" type="datetime-local" required />
        </div>

        <div className="mb-4">
          <label htmlFor="societyId">Society</label>

          <Select id="societyId" name="societyId" defaultValue="" required>
            <option value="" disabled>
              Select a society
            </option>

            {societies.map((society) => (
              <option key={society.id} value={society.id}>
                {society.name}
              </option>
            ))}
          </Select>
        </div>

        <EventCateringFields />
        <EventBrandingFields />

        <Button className="mt-2.5" type="submit">
          {saving ? "Creating..." : "Create event"}
        </Button>
      </fieldset>

      {error && <p role="alert">{error.message}</p>}
    </form>
  );
}
