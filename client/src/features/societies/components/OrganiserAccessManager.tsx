import { useState, type SubmitEvent } from "react";
import { Button } from "../../../components/ui/Button";
import { Disclosure } from "../../../components/ui/Disclosure";
import { Input } from "../../../components/ui/Fields";
import { authClient } from "../../../lib/auth-client";
import {
  useChangeSocietyOrganiser,
  useOrganisedSocieties,
  useSocietyOrganisers,
} from "../hooks";
import type { SocietySummary } from "../api";

export default function OrganiserAccessManager() {
  const societies = useOrganisedSocieties();
  if (societies.isPending) return <p role="status">Loading societies...</p>;
  if (societies.error) return <p role="alert">{societies.error.message}</p>;
  if (!societies.data.length)
    return (
      <p className="text-muted">
        No organiser access yet. Ask a society organiser to add you.
      </p>
    );

  return (
    <Disclosure className="mt-6">
      <summary>Society organiser access</summary>
      <p className="text-muted">
        Full access to society events and organiser management. Add door staff
        from the event’s Staff page.
      </p>
      <div className="grid gap-6">
        {societies.data.map((society) => (
          <SocietyAccess key={society.id} society={society} />
        ))}
      </div>
    </Disclosure>
  );
}

function SocietyAccess({ society }: { society: SocietySummary }) {
  const { data: session } = authClient.useSession();
  const query = useSocietyOrganisers(society.id);
  const mutation = useChangeSocietyOrganiser(society.id);
  const [email, setEmail] = useState("");

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    mutation.mutate(
      { kind: "add", email: email.trim() },
      { onSuccess: () => setEmail("") },
    );
  }

  return (
    <section aria-labelledby={`society-${society.id}`}>
      <h3 id={`society-${society.id}`}>{society.name}</h3>
      {query.isPending ? (
        <p role="status">Loading organisers...</p>
      ) : query.error ? (
        <p role="alert">{query.error.message}</p>
      ) : (
        <>
          <ul className="list-none divide-y divide-line pl-0">
            {query.data.map((person) => (
              <li
                key={person.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 wrap-anywhere">
                  <span className="block font-medium text-ink">
                    {person.name}
                    {person.id === session?.user.id ? " (you)" : ""}
                  </span>
                  <span className="text-muted">{person.email}</span>
                </div>
                <Button
                  variant="danger"
                  disabled={mutation.isPending || query.data.length <= 1}
                  onClick={() => {
                    const message =
                      person.id === session?.user.id
                        ? `Remove your organiser access to ${society.name}? You will lose management access to all its events.`
                        : `Remove ${person.name}'s organiser access to ${society.name} and all its events?`;
                    if (
                      window.confirm(
                        `${message}\n\n${person.id === session?.user.id ? "You remain" : "They remain"} a member and keep any door-staff access.`,
                      )
                    )
                      mutation.mutate({ kind: "remove", userId: person.id });
                  }}
                >
                  Remove access
                </Button>
              </li>
            ))}
          </ul>
          {query.data.length <= 1 && (
            <p className="text-muted">At least one organiser must remain.</p>
          )}
          <form onSubmit={submit}>
            <fieldset disabled={mutation.isPending}>
              <label htmlFor={`organiser-email-${society.id}`}>
                Registered account email
              </label>
              <div className="mb-4 flex items-start gap-3 max-sm:flex-col">
                <Input
                  id={`organiser-email-${society.id}`}
                  type="email"
                  maxLength={254}
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    mutation.reset();
                  }}
                />
                <Button className="mt-0 shrink-0" type="submit">
                  Add organiser
                </Button>
              </div>
            </fieldset>
          </form>
        </>
      )}
      {mutation.isPending && <p role="status">Updating access...</p>}
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
      {mutation.isSuccess && <p role="status">Organiser access updated.</p>}
    </section>
  );
}
