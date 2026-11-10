import { z } from 'zod';

export const Currency = z.enum(['NGN']);
export type Currency = z.infer<typeof Currency>;

export const IsoDateTime = z.iso.datetime();
export type IsoDateTime = z.infer<typeof IsoDateTime>;

export const Slug = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type Slug = z.infer<typeof Slug>;

export const OpaqueToken = z
  .string()
  .min(16)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
export type OpaqueToken = z.infer<typeof OpaqueToken>;

export const ApiErrorCode = z.enum([
  'network',
  'validation',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'payment_verification_failed',
  'rate_limited',
  'server',
  'unknown',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiErrorShape = z.object({
  code: ApiErrorCode,
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiErrorShape = z.infer<typeof ApiErrorShape>;
