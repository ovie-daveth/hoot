import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import type { WithdrawalRequestInput } from '@shared/contracts';

const ATTENDEES_ROOT = ['organiser', 'attendees'] as const;
const LEDGER_ROOT = ['organiser', 'ledger'] as const;
const WITHDRAWALS_ROOT = ['organiser', 'withdrawals'] as const;
const BANKS_ROOT = ['banks'] as const;

export const attendeeKeys = {
  all: ATTENDEES_ROOT,
  byEvent: (eventId?: string) => [...ATTENDEES_ROOT, 'event', eventId ?? null] as const,
};

export const ledgerKeys = {
  all: LEDGER_ROOT,
  entries: [...LEDGER_ROOT, 'entries'] as const,
  balance: [...LEDGER_ROOT, 'balance'] as const,
};

export const withdrawalKeys = {
  all: WITHDRAWALS_ROOT,
};

export const bankKeys = {
  all: BANKS_ROOT,
  list: [...BANKS_ROOT, 'list'] as const,
};

export function useEventAttendees(eventId?: string) {
  return useQuery({
    queryKey: attendeeKeys.byEvent(eventId),
    queryFn: () => api.getEventAttendees(eventId as string),
    enabled: !!eventId,
  });
}

export function useLedgerEntries() {
  return useQuery({
    queryKey: ledgerKeys.entries,
    queryFn: () => api.getLedgerEntries(),
  });
}

export function useOrganiserBalance() {
  return useQuery({
    queryKey: ledgerKeys.balance,
    queryFn: () => api.getOrganiserBalance(),
  });
}

export function useWithdrawals() {
  return useQuery({
    queryKey: withdrawalKeys.all,
    queryFn: () => api.getWithdrawals(),
  });
}

export function useBanks() {
  return useQuery({
    queryKey: bankKeys.list,
    queryFn: () => api.listBanks(),
  });
}

export function useRequestWithdrawalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WithdrawalRequestInput) => api.requestWithdrawal(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: withdrawalKeys.all });
      void queryClient.invalidateQueries({ queryKey: ledgerKeys.balance });
    },
  });
}

export function useVerifyBankAccountMutation() {
  return useMutation({
    mutationFn: (input: { bankCode: string; accountNumber: string }) =>
      api.verifyBankAccount(input),
  });
}
