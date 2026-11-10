import { z } from 'zod';

import { Currency, IsoDateTime } from './common';
import { MoneyMinor } from '../money';

export const PaymentProvider = z.enum(['monnify']);
export type PaymentProvider = z.infer<typeof PaymentProvider>;

export const PaymentStatus = z.enum(['pending', 'success', 'failed', 'abandoned', 'refunded']);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const Payment = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  registrationId: z.uuid(),
  provider: PaymentProvider,
  providerReference: z.string().min(1).max(100),
  amountMinor: MoneyMinor,
  currency: Currency,
  status: PaymentStatus,
  feeMinor: MoneyMinor.nullish(),
  commissionRateBps: z.number().int().gte(1).lte(10_000),
  commissionMinor: MoneyMinor.nullish(),
  createdAt: IsoDateTime,
  paidAt: IsoDateTime.nullish(),
});
export type Payment = z.infer<typeof Payment>;

export const StartPaymentResponse = z.object({
  payment: Payment,
  checkoutUrl: z.url(),
});
export type StartPaymentResponse = z.infer<typeof StartPaymentResponse>;

export type InitTransactionRequest = {
  reference: string;
  amountMinor: MoneyMinor;
  currency: Currency;
  customerName?: string;
  customerEmail: string;
  description?: string;
  callbackUrl?: string;
};

export type InitTransactionResult = {
  providerReference: string;
  checkoutUrl: string;
};

export type ProviderPaymentStatus = 'pending' | 'success' | 'failed' | 'abandoned' | 'reversed';

export type ProviderTransaction = {
  providerReference: string;
  status: ProviderPaymentStatus;
  amountMinor: number;
  currency: Currency;
  feeMinor: number | null;
  paidAt: IsoDateTime | null;
  raw: unknown;
};

export type ProviderWebhookEvent = {
  eventId: string;
  providerReference: string;
  status: ProviderPaymentStatus;
  amountMinor: number | null;
  occurredAt: IsoDateTime | null;
  raw: unknown;
};

export type RefundRequest = {
  providerReference: string;
  amountMinor: number;
  reason?: string;
};

export type RefundResult = {
  refundReference: string;
  status: 'accepted' | 'rejected';
  note?: string;
};

export type TransferDestination = {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
};

export type TransferRequest = {
  reference: string;
  amountMinor: number;
  currency: Currency;
  destination: TransferDestination;
  narration?: string;
};

export type TransferResult = {
  providerTransferReference: string;
  status: 'pending' | 'accepted' | 'rejected';
  note?: string;
};

export type BankVerification = {
  verified: boolean;
  accountName: string;
};

export interface PaymentAdapter {
  initTransaction(request: InitTransactionRequest): Promise<InitTransactionResult>;
  verifyPayment(providerReference: string): Promise<ProviderTransaction>;
  verifyWebhook(args: { rawBody: string; signature: string | undefined }): Promise<ProviderWebhookEvent>;
  refund(request: RefundRequest): Promise<RefundResult>;
  transfer(request: TransferRequest): Promise<TransferResult>;
  verifyBankAccount(input: { bankCode: string; accountNumber: string }): Promise<BankVerification>;
  listBanks(): Promise<Array<{ bankCode: string; bankName: string }>>;
}
