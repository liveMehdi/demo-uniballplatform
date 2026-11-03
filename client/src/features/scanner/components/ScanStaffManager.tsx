import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Fields";
import { useState } from "react";
import type { SubmitEvent } from "react";
import { useChangeScanStaff, useScanStaff } from "../hooks";

export default function ScanStaffManager({
  eventId,
  locked = false,
}: {
  eventId: string;
  locked?: boolean;
}) {
  const [email, setEmail] = useState("");
  const query = useScanStaff(eventId);
  const mutation = useChangeScanStaff(eventId);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || mutation.isPending) return;

    mutation.mutate(
      { kind: "add", email: email.trim() },
      { onSuccess: () => setEmail("") },
    );
  }

  if (query.isPending) return <p>Loading door staff...</p>;

  if (query.error) {
    return <p role="alert">{query.error.message}</p>;
  }

  return (
    <section aria-labelledby="scan-staff-heading">
      <h2 id="scan-staff-heading">Door staff</h2>

      <p className="text-muted">
        Add a registered user for event-only check-in access.
      </p>

      <form onSubmit={handleSubmit}>
        <fieldset disabled={locked || mutation.isPending}>
          <legend>Grant scan access</legend>

          <label htmlFor="scan-staff-email">Account email</label>
          <Input
            id="scan-staff-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              mutation.reset();
            }}
            required
          />

          <Button className="mt-2.5" type="submit">
            Add door staff
          </Button>
        </fieldset>
      </form>

      {mutation.isPending && <p role="status">Updating access...</p>}

      {mutation.error && <p role="alert">{mutation.error.message}</p>}

      {query.data?.length ? (
        <ul className="mt-6 list-none divide-y divide-line border-t border-line pl-0">
          {query.data.map((person) => (
            <li
              className="mt-0 flex flex-wrap items-center justify-between gap-3 py-4"
              key={person.id}
            >
              <div className="min-w-0 wrap-anywhere">
                <span className="block font-medium text-ink">
                  {person.name}
                </span>
                <span className="block text-muted">{person.email}</span>
              </div>
              <Button
                variant="danger"
                type="button"
                disabled={locked || mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    kind: "remove",
                    userId: person.id,
                  })
                }
              >
                Remove scan access
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No additional door staff assigned.</p>
      )}
    </section>
  );
}
