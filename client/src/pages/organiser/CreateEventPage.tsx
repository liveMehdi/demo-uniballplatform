import { Card, Page } from "../../components/ui/Layout";
import { Link } from "react-router";
import CreateEventForm from "../../features/events/components/CreateEventForm";

export default function CreateEventPage() {
  return (
    <Page className="max-w-4xl">
      <Link className="text-sm no-underline" to="/organiser">
        ← Back to your events
      </Link>
      <header className="mt-5 mb-6">
        <h1>Organise an event</h1>
        <p className="text-muted">
          Add the event details, then set up tickets and guest options.
        </p>
      </header>
      <Card>
        <CreateEventForm />
      </Card>
    </Page>
  );
}
