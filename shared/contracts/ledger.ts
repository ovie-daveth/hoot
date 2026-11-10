import { z } from 'zod';

import { Currency, IsoDateTime } from './common';
import { MoneyMinor } from '../money';
import { TransferDestination } from './payments';

export const LedgerEntryType = z.enum([
  'GROSS_PAYMENT',
  'PLATFORM_COMMISSION',
  'PROCESSING_FEE',
  'REFUND',
  'PAYOUT',
  'TRANSFER_FEE',
  'ADJUSTMENT',
]);
export type LedgerEntryType = z.infer<typeof LedgerEntryType>;

export const LedgerEntryDirection = z.enum(['credit', 'debit']);
export type LedgerEntryDirection = z.infer<typeof LedgerEntryDirection>;

export const LedgerEntry = z.object({
  id: z.uuid(),
  createdAt: IsoDateTime,
  type: LedgerEntryType,
  direction: LedgerEntryDirection,
  amountMinor: z.number().int().gt(0),
  currency: Currency,
  organiserId: z.uuid().nullish(),
  eventId: z.uuid().nullish(),
  registrationId: z.uuid().nullish(),
  paymentId: z.uuid().nullish(),
  withdrawalId: z.uuid().nullish(),
  runningPayableMinor: z.number().int().nullish(),
  note: z.string().max(280).nullish(),
});
export type LedgerEntry = z.infer<typeof LedgerEntry>;

export const WithdrawalStatus = z.enum(['requested', 'processing', 'paid', 'failed', 'reversed']);
export type WithdrawalStatus = z.infer<typeof WithdrawalStatus>;

export const WithdrawalDestination = z.object({
  bankName: z.string().min(1).max(120),
  bankCode: z.string().min(2).max(12),
  accountNumber: z.string().regex(/^\d{6,12}$/),
  accountName: z.string().min(1).max(150),
});
export type WithdrawalDestination = z.infer<typeof WithdrawalDestination>;

export const Withdrawal = z.object({
  id: z.uuid(),
  organiserId: z.uuid(),
  amountMinor: MoneyMinor,
  currency: Currency,
  feeMinor: MoneyMinor.nullish(),
  destination: WithdrawalDestination,
  status: WithdrawalStatus,
  providerTransferReference: z.string().min(1).max(100).nullish(),
  failureReason: z.string().max(280).nullish(),
  createdAt: IsoDateTime,
  paidAt: IsoDateTime.nullish(),
});
export type Withdrawal = z.infer<typeof Withdrawal>;

export const WithdrawalRequestInput = z.object({
  amountMinor: MoneyMinor,
  destination: WithdrawalDestination,
});
export type WithdrawalRequestInput = z.infer<typeof WithdrawalRequestInput>;

export const OrganiserBalance = z.object({
  organiserId: z.uuid(),
  currency: Currency,
  grossSalesMinor: MoneyMinor,
  platformCommissionMinor: MoneyMinor,
  processingFeesMinor: MoneyMinor,
  refundsMinor: MoneyMinor,
  payoutsMinor: MoneyMinor,
  transferFeesMinor: MoneyMinor,
  adjustmentsMinor: z.number().int(),
  payableMinor: z.number().int(),
  pendingWithdrawalMinor: MoneyMinor,
  asOf: IsoDateTime,
});
export type OrganiserBalance = z.infer<typeof OrganiserBalance>;
