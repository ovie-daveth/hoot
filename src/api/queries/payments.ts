import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import type { Payment, StartPaymentResponse } from '@shared/contracts';

import { ticketKeys } from './tickets';

export const paymentKeys = {
  all: ['payments'] as const,
  byRegistration: (registrationId?: string) =>
    [...paymentKeys.all, 'registration', registrationId ?? null] as const,
};

export function usePayment(registrationId?: string) {
  return useQuery({
    queryKey: paymentKeys.byRegistration(registrationId),
    queryFn: () => api.getPayment(registrationId as string),
    enabled: !!registrationId,
    refetchInterval: (query) => {
      const payment: Payment | null = query.state.data ?? null;
      return payment && payment.status === 'pending' ? 1_500 : false;
    },
  });
}

export function useStartPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (registrationId: string) => api.startPayment(registrationId),
    onSuccess: (response: StartPaymentResponse) => {
      void queryClient.invalidateQueries({
        queryKey: paymentKeys.byRegistration(response.payment.registrationId),
      });
      void queryClient.invalidateQueries({ queryKey: ticketKeys.mine });
    },
  });
}
