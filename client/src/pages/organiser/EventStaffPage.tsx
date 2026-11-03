import { Card } from "../../components/ui/Layout";
import ScanStaffManager from "../../features/scanner/components/ScanStaffManager";
import { useWorkspaceEvent } from "../../app/useWorkspaceEvent";

export default function EventStaffPage() {
  const event = useWorkspaceEvent();
  return (
    <section className="grid min-w-0 gap-6 [&>button]:justify-self-start">
      <h2>Staff</h2>

      <Card>
        <ScanStaffManager
          eventId={event.id}
          locked={Boolean(event.cancelledAt)}
        />
      </Card>
    </section>
  );
}
