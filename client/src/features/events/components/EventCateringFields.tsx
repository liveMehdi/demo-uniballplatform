import { toLocalDateTime } from "../../../lib/format";
import { useState } from "react";
import { Input } from "../../../components/ui/Fields";

export default function EventCateringFields({
  deadline,
}: {
  deadline?: string | null;
}) {
  const [included, setIncluded] = useState(Boolean(deadline));
  const [value, setValue] = useState(deadline ? toLocalDateTime(deadline) : "");
  return (
    <div className="mb-5">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={included}
          onChange={(event) => {
            setIncluded(event.target.checked);
            if (event.target.checked && !value) {
              const start = event.target.form?.elements.namedItem("startsAt");
              if (start instanceof HTMLInputElement && start.value) {
                setValue(
                  toLocalDateTime(
                    new Date(
                      new Date(start.value).getTime() - 7 * 86_400_000,
                    ).toISOString(),
                  ),
                );
              }
            }
          }}
        />{" "}
        Includes a meal
      </label>
      {included && (
        <>
          <label htmlFor="catering-deadline">
            Catering deadline{" "}
            <span className="ml-2 text-xs font-normal text-muted">
              Local time
            </span>
          </label>
          <input
            type="hidden"
            name="cateringDeadline"
            value={
              deadline && value === toLocalDateTime(deadline) ? deadline : value
            }
          />
          <Input
            id="catering-deadline"
            name="cateringDeadlineLocal"
            type="datetime-local"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-describedby="catering-deadline-help"
            required
          />
          <p id="catering-deadline-help" className="mt-2 text-sm text-muted">
            Sales, reservations, meal choices and dietary edits close at this
            time.
          </p>
        </>
      )}
    </div>
  );
}
