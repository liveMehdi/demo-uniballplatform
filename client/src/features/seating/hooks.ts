import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../lib/auth-client";
import {
  changeGuestGroup,
  getEventSeating,
  createEventTable,
  assignGuestTable,
  updateEventTable,
  deleteEventTable,
} from "./api";
import type { GroupAction } from "./api";
import {
  assignGroupTable,
  setSeatingPublication,
  getBookingSeating,
} from "./api";

export function useChangeGuestGroup(guestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: GroupAction) => changeGuestGroup(guestId, action),
    retry: false,

    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["booking-guests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["organiser-guests"],
        }),
      ]);
    },
  });
}

export function useEventSeating(eventId: string) {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: ["event-seating", session?.user.id, eventId],
    queryFn: ({ signal }) => getEventSeating(eventId, signal),
    enabled: Boolean(session),
    retry: false,
    gcTime: 0,
    refetchInterval: 30_000,
  });
}

export function useCreateEventTable(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; capacity: number }) =>
      createEventTable(eventId, input),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["event-seating"],
      });
    },
  });
}

export function useAssignGuestTable(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { guestId: string; tableId: string | null }) =>
      assignGuestTable(eventId, input.guestId, input.tableId),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["event-seating"],
      });
    },
  });
}

export function useAssignGroupTable(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { groupId: string; tableId: string | null }) =>
      assignGroupTable(eventId, input.groupId, input.tableId),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["event-seating"],
      });
    },
  });
}

export function useUpdateEventTable(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { tableId: string; name: string; capacity: number }) =>
      updateEventTable(eventId, input.tableId, {
        name: input.name,
        capacity: input.capacity,
      }),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["event-seating"],
      });
    },
  });
}

export function useDeleteEventTable(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tableId: string) => deleteEventTable(eventId, tableId),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["event-seating"],
      });
    },
  });
}

export function useSetSeatingPublication(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (published: boolean) =>
      setSeatingPublication(eventId, published),
    retry: false,
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["event-seating"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["booking-seating"],
        }),
      ]);
    },
  });
}

export function useBookingSeating(bookingId: string) {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: ["booking-seating", session?.user.id, bookingId],
    queryFn: ({ signal }) => getBookingSeating(bookingId, signal),
    enabled: Boolean(session),
    retry: false,
    gcTime: 0,
    refetchInterval: 30_000,
  });
}