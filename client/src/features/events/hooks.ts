import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createEvent,
  createMealOption,
  getEvent,
  getEvents,
  getOrganiserEvents,
  updateEventCapacity,
  updateEventSettings,
  cancelEvent,
  type CreateMealOptionInput,
} from "./api";
import { authClient } from "../../lib/auth-client";
import type { EventSettingsAction } from "./api";
import {
  getMealOptions,
  updateMealOption,
  type UpdateMealOptionInput,
} from "./api";

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: ({ signal }) => getEvents(signal),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEvent,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["events"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["organiser", "events"],
        }),
      ]);
    },
  });
}

export function useEvent(eventId: string) {
  const { data: session, isPending } = authClient.useSession();
  return useQuery({
    queryKey: ["events", eventId, session?.user.id],
    enabled: !isPending,
    queryFn: ({ signal }) => getEvent(eventId, signal),
    retry: false,
  });
}

export function useOrganiserEvents() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["organiser", "events", userId],
    queryFn: ({ signal }) => getOrganiserEvents(signal),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });
}

export function useUpdateEventCapacity(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (capacity: number) => updateEventCapacity(eventId, capacity),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["events", eventId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["organiser", "events"],
        }),
      ]);
    },
  });
}

export function useCreateMealOption(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMealOptionInput) =>
      createMealOption(eventId, input),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["events", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["meal-options", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["booking-guests"] }),
      ]);
    },
  });
}

export function useMealOptions(eventId: string) {
  const { data: session } = authClient.useSession();
  return useQuery({
    queryKey: ["meal-options", eventId, session?.user.id],
    queryFn: ({ signal }) => getMealOptions(eventId, signal),
    enabled: Boolean(session),
    retry: false,
    gcTime: 0,
  });
}

export function useUpdateMealOption(eventId: string, mealOptionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMealOptionInput) =>
      updateMealOption(eventId, mealOptionId, input),
    retry: false,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["events", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["meal-options", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["booking-guests"] }),
        queryClient.invalidateQueries({ queryKey: ["organiser-guests"] }),
      ]);
    },
  });
}

export function useUpdateEventSettings(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: EventSettingsAction) =>
      updateEventSettings(eventId, action),
    retry: false,
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({
          queryKey: ["organiser", "events"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["scanner-events"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["event-seating"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["booking-guests"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["bookings", "mine"],
        }),
      ]);
    },
  });
}

export function useCancelEvent(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => cancelEvent(eventId),
    retry: false,
    onSettled: async () => {
      await queryClient.invalidateQueries();
    },
  });
}
