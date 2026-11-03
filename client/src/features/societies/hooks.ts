import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../lib/auth-client";
import {
  changeSocietyOrganiser,
  getOrganisedSocieties,
  getSocietyOrganisers,
  type OrganiserAccessAction,
} from "./api";

export function useSocietyOrganisers(societyId: string) {
  const { data: session } = authClient.useSession();
  return useQuery({
    queryKey: ["societies", "organisers", session?.user.id, societyId],
    queryFn: ({ signal }) => getSocietyOrganisers(societyId, signal),
    enabled: Boolean(session),
    retry: false,
    gcTime: 0,
  });
}

export function useChangeSocietyOrganiser(societyId: string) {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  return useMutation({
    mutationFn: (action: OrganiserAccessAction) =>
      changeSocietyOrganiser(societyId, action),
    retry: false,
    onSuccess: async (_, action) => {
      if (action.kind === "remove" && action.userId === session?.user.id) {
        await queryClient.cancelQueries();
        await queryClient.resetQueries({
          predicate: (query) => query.queryKey[0] !== "events",
        });
        return;
      }
      await queryClient.invalidateQueries();
    },
  });
}

export function useOrganisedSocieties() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["societies", "organised", userId],
    queryFn: ({ signal }) => getOrganisedSocieties(signal),
    enabled: Boolean(userId),
  });
}
