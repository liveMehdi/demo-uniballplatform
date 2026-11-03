import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../lib/auth-client";
import {
  confirmBooking,
  cancelBooking,
  createBooking,
  getEventBookings,
  getMyBookings,
  getBookingGuests,
  updateBookingGuest,
  getEventGuests,
} from "./api";
import type {
  CreateBookingInput,
  GuestDetailsInput,
  GuestListStatus,
} from "./api";

export function useCreateBooking(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBookingInput) => createBooking(eventId, input),
    retry: false,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["bookings", "mine"],
      });
    },
  });
}

export function useMyBookings() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["bookings", "mine", userId],
    queryFn: ({ signal }) => getMyBookings(signal),
    enabled: Boolean(userId),
    refetchInterval: (query) =>
      query.state.data?.some((booking) => booking.status === "PENDING")
        ? 15_000
        : false,
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  return useMutation({
    mutationFn: cancelBooking,
    retry: false,

    onSettled: async (_, _error, bookingId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["bookings", "mine", session?.user.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["booking-guests", session?.user.id, bookingId],
        }),
        queryClient.invalidateQueries({ queryKey: ["organiser", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["event-seating"] }),
      ]);
    },
  });
}

export function useEventBookings(eventId: string, page: number) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["organiser", "events", userId, eventId, "bookings", page],
    queryFn: ({ signal }) => getEventBookings(eventId, page, signal),
    enabled: Boolean(userId),
    retry: false,
  });
}

export function useBookingGuests(bookingId: string) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["booking-guests", userId, bookingId],
    queryFn: ({ signal }) => getBookingGuests(bookingId, signal),
    enabled: Boolean(userId),
    retry: false,
  });
}

export function useUpdateBookingGuest(bookingId: string, guestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GuestDetailsInput) =>
      updateBookingGuest(bookingId, guestId, input),

    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["booking-guests"],
      });
    },
  });
}

export function useEventGuests(eventId: string, status: GuestListStatus) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["organiser-guests", userId, eventId, status],
    queryFn: ({ signal }) => getEventGuests(eventId, status, signal),
    enabled: Boolean(userId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useConfirmBooking(
  bookingId: string,
  mode: "free" | "simulated",
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => confirmBooking(bookingId, mode),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries();
    },
  });
}
