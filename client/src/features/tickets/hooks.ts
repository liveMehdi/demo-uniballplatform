import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  checkInTicket,
  createTicketType,
  prepareBookingTickets,
  manageEventTicket,
  requestTicketEmail,
} from "./api";
import type { CreateTicketTypeInput, TicketManagementAction } from "./api";

export function useCreateTicketType(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketTypeInput) =>
      createTicketType(eventId, input),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["events", eventId],
      });
    },
  });
}

export function usePrepareBookingTickets(bookingId: string) {
  return useMutation({
    mutationFn: () => prepareBookingTickets(bookingId),
    retry: false,
    gcTime: 0,
  });
}

export function useCheckInTicket(
  eventId: string,
  lookupBy: "token" | "id" = "token",
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credential: string) =>
      checkInTicket(eventId, credential, lookupBy),
    retry: false,
    gcTime: 0,
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["scanner-attendance"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["scanner-guests"],
        }),
      ]);
    },
  });
}

export function useManageEventTicket(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: TicketManagementAction) =>
      manageEventTicket(eventId, action),
    retry: false,
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({
          queryKey: ["scanner-guests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["scanner-attendance"],
        }),
      ]);
    },
  });
}
export function useRequestTicketEmail(bookingId: string) {
  return useMutation({
    mutationFn: () => requestTicketEmail(bookingId),
    retry: false,
    gcTime: 0,
  });
}