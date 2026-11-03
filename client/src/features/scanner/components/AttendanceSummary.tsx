import { useAttendance } from "../hooks";

export default function AttendanceSummary({ eventId }: { eventId: string }) {
  const { data, isPending, error } = useAttendance(eventId);

  return (
    <section aria-labelledby="attendance-heading">
      <h2 id="attendance-heading">Attendance</h2>

      {isPending ? (
        <p>Loading attendance...</p>
      ) : error ? (
        <p role="alert">{error.message}</p>
      ) : data ? (
        <dl className="grid-cols-3 gap-4 max-sm:grid-cols-1 [&_dd]:mt-1 [&_dd]:text-2xl [&_dd]:font-medium [&_dd]:text-ink [&_dd]:tabular-nums">
          <div>
            <dt>Confirmed guest places</dt>
            <dd>{data.confirmedGuests}</dd>
          </div>
          <div>
            <dt>Checked in</dt>
            <dd>{data.checkedIn}</dd>
          </div>
          <div>
            <dt>Not yet checked in</dt>
            <dd>{data.remaining}</dd>
          </div>
        </dl>
      ) : null}

      <p className="text-xs text-muted">
        Refreshes every five seconds while this page is active.
      </p>
    </section>
  );
}
