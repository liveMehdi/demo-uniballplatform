import { Modal } from "../../components/ui/Modal";
import { Card } from "../../components/ui/Layout";
import { useWorkspaceEvent } from "../../app/useWorkspaceEvent";
import EventManagementControls from "../../features/events/components/EventManagementControls";
import CancelEventControl from "../../features/events/components/CancelEventControl";
export default function EventSettingsPage() {
  const event = useWorkspaceEvent();
  return (
    <section className="grid min-w-0 gap-6 [&>button]:justify-self-start">
      <div>
        <h2 className="mb-2">Settings</h2>
        <p className="text-muted">
          Update the details guests see on your event page.
        </p>
      </div>
      <Card>
        <dl>
          <dt>Title</dt>
          <dd className="font-serif">{event.title}</dd>
          <dt>Venue</dt>
          <dd>{event.venue}</dd>
          <dt>Starts</dt>
          <dd>{new Date(event.startsAt).toLocaleString("en-GB")}</dd>
          <dt>Description</dt>
          <dd className="whitespace-pre-wrap">
            {event.description || "No description added."}
          </dd>
        </dl>
        {!event.cancelledAt && (
          <div className="border-t border-line pt-5">
            <EventManagementControls event={event} />
          </div>
        )}
      </Card>
      <Modal
        title="Event cancellation"
        triggerLabel={
          event.cancelledAt ? "Cancellation record" : "Cancel this event"
        }
        variant="danger"
      >
        <CancelEventControl
          eventId={event.id}
          eventTitle={event.title}
          cancelledAt={event.cancelledAt}
        />
      </Modal>
    </section>
  );
}
