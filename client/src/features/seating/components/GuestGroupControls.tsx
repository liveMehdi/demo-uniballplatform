import { Input } from "../../../components/ui/Fields";
import { Button } from "../../../components/ui/Button";
import { useState } from "react";
import type { SubmitEvent } from "react";
import type { TableGroupSummary } from "../api";
import { useChangeGuestGroup } from "../hooks";

type Props = {
  guestId: string;
  group: TableGroupSummary | null;
  canJoin: boolean;
  canLeave: boolean;
};

export default function GuestGroupControls({
  guestId,
  group,
  canJoin,
  canLeave,
}: Props) {
  const { mutate, isPending, error } = useChangeGuestGroup(guestId);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  function handleCreate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canJoin || isPending) return;

    const data = new FormData(event.currentTarget);

    mutate({
      kind: "create",
      name: String(data.get("name") ?? ""),
    });
  }

  function handleJoin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canJoin || isPending) return;

    const data = new FormData(event.currentTarget);

    mutate({
      kind: "join",
      inviteCode: String(data.get("inviteCode") ?? ""),
    });
  }

  async function copyInviteCode() {
    if (!group) return;

    try {
      await navigator.clipboard.writeText(group.inviteCode);
      setCopyMessage("Invite code copied.");
    } catch {
      setCopyMessage(
        "Could not copy automatically. Select the code to copy it.",
      );
    }
  }

  return (
    <section aria-labelledby={`seating-heading-${guestId}`}>
      <h3 id={`seating-heading-${guestId}`}>Seating group</h3>

      {group ? (
        <>
          <p>
            <strong>{group.name}</strong>
            {" — "}group limit: {group.maxSize}
          </p>

          {canJoin && (
            <p className="wrap-anywhere">
              Invite code: <code>{group.inviteCode}</code>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {canJoin && (
              <Button
                variant="secondary"
                type="button"
                onClick={copyInviteCode}
              >
                Copy invite code
              </Button>
            )}
            {canLeave && (
              <Button
                variant="secondary"
                type="button"
                disabled={isPending}
                onClick={() => mutate({ kind: "leave" })}
              >
                {isPending ? "Updating..." : "Leave group"}
              </Button>
            )}
          </div>
          {canJoin && copyMessage && <p role="status">{copyMessage}</p>}
        </>
      ) : canJoin ? (
        <>
          <form onSubmit={handleCreate}>
            <fieldset disabled={isPending}>
              <legend>Create a group</legend>

              <label htmlFor={`group-name-${guestId}`}>Group name</label>
              <Input
                id={`group-name-${guestId}`}
                name="name"
                maxLength={80}
                required
              />

              <Button className="mt-2.5" type="submit">
                Create group
              </Button>
            </fieldset>
          </form>

          <form
            className="mt-5 border-t border-line pt-5"
            onSubmit={handleJoin}
          >
            <fieldset disabled={isPending}>
              <legend>Join a group</legend>

              <label htmlFor={`invite-${guestId}`}>Invite code</label>
              <Input id={`invite-${guestId}`} name="inviteCode" required />

              <Button className="mt-2.5" type="submit">
                Join group
              </Button>
            </fieldset>
          </form>
        </>
      ) : (
        <p>An active reservation or confirmed booking is required to join.</p>
      )}

      {error && <p role="alert">{error.message}</p>}
    </section>
  );
}
