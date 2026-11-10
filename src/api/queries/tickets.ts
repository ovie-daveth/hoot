import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import type { RegisterInput } from '@shared/contracts';

import { eventKeys } from './events';
import { attendeeKeys } from './organiser';

const TICKETS_ROOT = ['tickets'] as const;

export const ticketKeys = {
  all: TICKETS_ROOT,
  eventTypes: (eventId?: string) => [...TICKETS_ROOT, 'types', eventId ?? null] as const,
  mine: [...TICKETS_ROOT, 'mine'] as const,
  byToken: (token?: string) => [...TICKETS_ROOT, 'token', token ?? null] as const,
};

const invalidateEventInventory = (queryClient: ReturnType<typeof useQueryClient>, eventId: string) => {
  void queryClient.invalidateQueries({ queryKey: ticketKeys.eventTypes(eventId) });
  void queryClient.invalidateQueries({ queryKey: eventKeys.all });
};

export function useTicketTypes(eventId?: string) {
  return useQuery({
    queryKey: ticketKeys.eventTypes(eventId),
    queryFn: () => api.getTicketTypes(eventId as string),
    enabled: !!eventId,
  });
}

export function useMyTickets() {
  return useQuery({
    queryKey: ticketKeys.mine,
    queryFn: () => api.getTickets(),
  });
}

export function useTicketByToken(token?: string) {
  return useQuery({
    queryKey: ticketKeys.byToken(token),
    queryFn: () => api.getTicketByToken(token as string),
    enabled: !!token,
  });
}

export function useRegisterMutation(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => api.register(eventId, input),
    onSuccess: (data) => {
      invalidateEventInventory(queryClient, eventId);
      if (data.registration.status === 'confirmed') {
        void queryClient.invalidateQueries({ queryKey: ticketKeys.mine });
      }
    },
  });
}

export function useCheckInMutation(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.checkIn(eventId, code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: attendeeKeys.byEvent(eventId) });
    },
  });
}

export function useCreateTicketTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      input,
    }: {
      eventId: string;
      input: Parameters<typeof api.createTicketType>[1];
    }) => api.createTicketType(eventId, input),
    onSuccess: (_data, variables) => {
      const { eventId } = variables;
      void queryClient.invalidateQueries({ queryKey: ticketKeys.eventTypes(eventId) });
    },
  });
}

export function useUpdateTicketTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      id,
      input,
    }: {
      eventId: string;
      id: string;
      input: Parameters<typeof api.updateTicketType>[1];
    }) => api.updateTicketType(id, input),
    onSuccess: (_data, variables) => {
      const { eventId } = variables;
      void queryClient.invalidateQueries({ queryKey: ticketKeys.eventTypes(eventId) });
    },
  });
}
