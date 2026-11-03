import { Card, TableScroll } from "../../components/ui/Layout";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Fields";
import { useWorkspaceEvent } from "../../app/useWorkspaceEvent";
import MealOptionsManager from "../../features/events/components/MealOptionsManager";
import { useNow } from "../../lib/useNow";
import { useState } from "react";
import { useEventGuests } from "../../features/bookings/hooks";
import { downloadCateringCsv } from "../../features/bookings/api";
import type { GuestListStatus } from "../../features/bookings/api";

export default function EventGuestsPage() {
  const { id: eventId } = useWorkspaceEvent();

  return <EventGuests key={eventId} eventId={eventId} />;
}

function EventGuests({ eventId }: { eventId: string }) {
  const now = useNow();
  const event = useWorkspaceEvent();
  const [status, setStatus] = useState<GuestListStatus>("CONFIRMED");

  const { data, isPending, error, isFetching, refetch } = useEventGuests(
    eventId,
    status,
  );

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);

    try {
      await downloadCateringCsv(eventId, status);
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Could not export catering report.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="grid min-w-0 gap-6 [&>button]:justify-self-start">
      <h2>Guests & catering</h2>
      <MealOptionsManager
        eventId={eventId}
        locked={
          Boolean(event.cancelledAt) ||
          new Date(event.cateringDeadline ?? event.startsAt).getTime() <= now
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="mb-0 text-muted" htmlFor="guest-list-status">
          Show
        </label>
        <Select
          id="guest-list-status"
          disabled={exporting}
          value={status}
          onChange={(event) => {
            const value = event.target.value;

            if (value === "PENDING" || value === "CONFIRMED") {
              setExportError(null);
              setStatus(value);
            }
          }}
        >
          <option value="CONFIRMED">Confirmed guests</option>
          <option value="PENDING">Pending preview</option>
        </Select>

        <Button
          variant="secondary"
          type="button"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? "Refreshing..." : "Refresh"}
        </Button>
        <Button
          type="button"
          disabled={exporting || isFetching || !data || Boolean(error)}
          onClick={handleExport}
        >
          {exporting
            ? "Exporting..."
            : status === "CONFIRMED"
              ? "Export catering CSV"
              : "Export pending preview CSV"}
        </Button>
      </div>
      {exportError && <p role="alert">{exportError}</p>}
      {status === "PENDING" && (
        <p className="text-muted">These bookings aren't confirmed yet.</p>
      )}

      {isPending ? (
        <p>Loading guests...</p>
      ) : error ? (
        <p role="alert">{error.message}</p>
      ) : data ? (
        <>
          <Card as="section" aria-labelledby="requirements-heading">
            <h2 id="requirements-heading">Requirements summary</h2>

            <dl className="mb-0 [&_dd]:tabular-nums">
              <dt>Total guest places</dt>
              <dd>{data.summary.totalGuests}</dd>

              <dt>Names provided</dt>
              <dd>{data.summary.namedGuests}</dd>

              <dt>Names missing</dt>
              <dd>{data.summary.missingNames}</dd>

              <dt>Guests with dietary information</dt>
              <dd>{data.summary.dietaryRequests}</dd>

              <dt>Guests with accessibility information</dt>
              <dd>{data.summary.accessibilityRequests}</dd>
            </dl>
          </Card>
          <Card as="section" aria-labelledby="meal-totals-heading">
            <h2 id="meal-totals-heading">
              {status === "CONFIRMED"
                ? "Meal totals"
                : "Provisional meal totals"}
            </h2>

            <p className="text-muted">
              No meal selected: {data.summary.missingMealChoices}
            </p>

            {data.summary.meals.length === 0 ? (
              <p>No meal selections in this view.</p>
            ) : (
              <TableScroll
                role="region"
                aria-label="Scrollable records"
                tabIndex={0}
              >
                <table>
                  <caption>Selected meals by option</caption>
                  <thead>
                    <tr>
                      <th scope="col">Meal</th>
                      <th scope="col">Guests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.meals.map((meal) => (
                      <tr key={meal.mealOptionId}>
                        <th scope="row">{meal.name}</th>
                        <td>{meal.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            )}
          </Card>

          {data.guests.length === 0 ? (
            <p>No guests in this view.</p>
          ) : (
            <TableScroll
              role="region"
              aria-label="Scrollable records"
              tabIndex={0}
            >
              <table>
                <caption>
                  {status === "CONFIRMED"
                    ? "Confirmed guest details"
                    : "Pending reservation guest details"}
                </caption>

                <thead>
                  <tr>
                    <th scope="col">Guest</th>
                    <th scope="col">Tier</th>
                    <th scope="col">Meal choice</th>
                    <th scope="col">Seating group</th>
                    <th scope="col">Dietary requirements</th>
                    <th scope="col">Accessibility needs</th>
                    <th scope="col">Booking reference</th>
                  </tr>
                </thead>

                <tbody>
                  {data.guests.map((guest) => (
                    <tr key={guest.id}>
                      <th scope="row">
                        {guest.fullName || "Name not provided"}
                      </th>
                      <td>{guest.tier === "STANDARD" ? "Standard" : "VIP"}</td>
                      <td>
                        {guest.mealOption?.name ?? "No meal selected"}
                        {guest.mealOption && !guest.mealOption.isAvailable && (
                          <span> — retired option</span>
                        )}
                      </td>
                      <td>{guest.tableGroup?.name ?? "No group"}</td>
                      <td className="whitespace-pre-wrap">
                        {guest.dietaryRequirements || "Not provided"}
                      </td>
                      <td className="whitespace-pre-wrap">
                        {guest.accessibilityNeeds || "Not provided"}
                      </td>
                      <td className="text-xs text-muted">{guest.bookingId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </>
      ) : null}
    </section>
  );
}
