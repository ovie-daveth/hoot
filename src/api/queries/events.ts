import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import type { EventFilters } from '@/api/types';
import type { EventUpsertInput } from '@shared/contracts';

export const eventKeys = {
  all: ['events'] as const,
  list: (filters?: EventFilters) => [...eventKeys.all, 'list', filters ?? {}] as const,
  bySlug: (slug?: string) => [...eventKeys.all, 'detail', slug ?? null] as const,
  organiserAll: ['organiser', 'events'] as const,
};

export function useEvents(filters?: EventFilters) {
  return useQuery({
    queryKey: eventKeys.list(filters),
    queryFn: () => api.getEvents(filters),
  });
}

export function useEvent(slug?: string) {
  return useQuery({
    queryKey: eventKeys.bySlug(slug),
    queryFn: () => api.getEventBySlug(slug as string),
    enabled: !!slug,
  });
}

export function useMyEvents() {
  return useQuery({
    queryKey: eventKeys.organiserAll,
    queryFn: () => api.getMyEvents(),
  });
}

export function useCreateEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventUpsertInput) => api.createEvent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.organiserAll });
    },
  });
}

export function useUpdateEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, input }: { eventId: string; input: EventUpsertInput }) =>
      api.updateEvent(eventId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.organiserAll });
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

export function usePublishEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.publishEvent(eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.organiserAll });
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

export function useCancelEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.cancelEvent(eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKeys.organiserAll });
      void queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}
