import { checkResponse } from "../../lib/apiError.ts";

export type SocietySummary = {
  id: string;
  name: string;
};

export type SocietyOrganiser = { id: string; name: string; email: string };
export type OrganiserAccessAction =
  | { kind: "add"; email: string }
  | { kind: "remove"; userId: string };

export async function getSocietyOrganisers(
  societyId: string,
  signal?: AbortSignal,
): Promise<SocietyOrganiser[]> {
  const response = await fetch(
    `/api/societies/${encodeURIComponent(societyId)}/organisers`,
    { signal },
  );
  if (!response.ok)
    throw new Error(
      "Could not load organisers. Check you still have access to this society.",
    );
  return response.json();
}

export async function changeSocietyOrganiser(
  societyId: string,
  action: OrganiserAccessAction,
): Promise<void> {
  const suffix =
    action.kind === "remove" ? `/${encodeURIComponent(action.userId)}` : "";
  const response = await fetch(
    `/api/societies/${encodeURIComponent(societyId)}/organisers${suffix}`,
    {
      method: action.kind === "add" ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      ...(action.kind === "add"
        ? { body: JSON.stringify({ email: action.email }) }
        : {}),
    },
  );
  await checkResponse(response, "Could not update organiser access.");
}

export async function getOrganisedSocieties(
  signal?: AbortSignal,
): Promise<SocietySummary[]> {
  const response = await fetch("/api/societies/organised", {
    signal,
  });

  if (!response.ok) {
    throw new Error("Could not load your societies.");
  }

  return response.json();
}
