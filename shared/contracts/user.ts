import { z } from 'zod';

import { IsoDateTime } from './common';

export const User = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1).max(120),
  avatarUrl: z.url().nullish(),
  createdAt: IsoDateTime,
});
export type User = z.infer<typeof User>;

export const BankAccount = z.object({
  bankName: z.string().min(1).max(120),
  bankCode: z.string().min(2).max(12),
  accountNumber: z.string().regex(/^\d{6,12}$/),
  accountName: z.string().min(1).max(150),
});
export type BankAccount = z.infer<typeof BankAccount>;

export const OrganiserProfile = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  displayName: z.string().min(1).max(120),
  description: z.string().max(2000).nullish(),
  payoutBankAccount: BankAccount.nullish(),
  createdAt: IsoDateTime,
});
export type OrganiserProfile = z.infer<typeof OrganiserProfile>;
