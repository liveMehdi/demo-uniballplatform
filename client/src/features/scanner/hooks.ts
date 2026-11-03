import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../lib/auth-client";
import {
  recoverGuestTicket,
  getScannerEvents,
  getScanStaff,
  addScanStaff,
  removeScanStaff,
  searchGuests,
  getAttendance,
} from "./api";

export function useScannerEvents() {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: ["scanner-events", session?.user.id],
    queryFn: ({ signal }) => getScannerEvents(signal),
    enabled: Boolean(session),
    retry: false,
    gcTime: 0,
    refetchInterval: 30_000,
  });
}

export function useScanStaff(eventId: string) {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: ["scan-staff", session?.user.id, eventId],
    queryFn: ({ signal }) => getScanStaff(eventId, signal),
    enabled: Boolean(session),
    retry: false,
    gcTime: 0,
  });
}

export function useChangeScanStaff(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      action:
        | { kind: "add"; email: string }
        | { kind: "remove"; userId: string },
    ) =>
      action.kind === "add"
        ? addScanStaff(eventId, action.email)
        : removeScanStaff(eventId, action.userId),
    retry: false,
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["scan-staff"] }),
        queryClient.invalidateQueries({ queryKey: ["scanner-events"] }),
      ]);
    },
  });
}

export function useAttendance(eventId: string) {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: ["scanner-attendance", session?.user.id, eventId],
    queryFn: ({ signal }) => getAttendance(eventId, signal),
    enabled: Boolean(session),
    retry: false,
    gcTime: 0,
    refetchInterval: 5_000,
  });
}

export function useGuestSearch(eventId: string, search: string) {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: ["scanner-guests", session?.user.id, eventId, search],
    queryFn: ({ signal }) => searchGuests(eventId, search, signal),
    enabled: Boolean(session) && search.length >= 2,
    retry: false,
    gcTime: 0,
  });
}
export function useRecoverGuestTicket(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guestId: string) => recoverGuestTicket(eventId, guestId),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["scanner-guests"] });
    },
  });
}
