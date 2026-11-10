import { z } from 'zod';

import { Currency, IsoDateTime, OpaqueToken } from './common';
import { MoneyMinor } from '../money';

export const RegistrationStatus = z.enum([
  'pending',
  'confirmed',
  'cancelled',
  'refunded',
  'checked_in',
]);
export type RegistrationStatus = z.infer<typeof RegistrationStatus>;

export const TicketStatus = z.enum(['valid', 'checked_in', 'cancelled', 'refunded']);
export type TicketStatus = z.infer<typeof TicketStatus>;

const ticketTypeObject = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
  priceMinor: MoneyMinor,
  currency: Currency,
  quantityTotal: z.number().int().gt(0),
  quantitySold: z.number().int().gte(0),
  salesStartsAt: IsoDateTime.nullish(),
  salesEndsAt: IsoDateTime.nullish(),
  minPerOrder: z.number().int().gte(1).default(1),
  maxPerOrder: z.number().int().gte(1).default(10),
  isActive: z.boolean(),
});

export const TicketType = ticketTypeObject.refine(
  (ticketType) => ticketType.maxPerOrder >= ticketType.minPerOrder,
  { error: 'maxPerOrder must be greater than or equal to minPerOrder', path: ['maxPerOrder'] },
);
export type TicketType = z.infer<typeof TicketType>;

export const TicketTypeUpsertInput = ticketTypeObject
  .omit({ id: true, eventId: true, quantitySold: true })
  .partial();
export type TicketTypeUpsertInput = z.infer<typeof TicketTypeUpsertInput>;

export const Registration = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  ticketTypeId: z.uuid(),
  quantity: z.number().int().gte(1).default(1),
  grossMinor: MoneyMinor,
  currency: Currency,
  status: RegistrationStatus,
  userId: z.uuid().nullish(),
  guestName: z.string().min(1).max(120).nullish(),
  guestEmail: z.email().nullish(),
  holdExpiresAt: IsoDateTime.nullish(),
  createdAt: IsoDateTime,
});
export type Registration = z.infer<typeof Registration>;

export const Ticket = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  registrationId: z.uuid(),
  code: OpaqueToken,
  status: TicketStatus,
  issuedAt: IsoDateTime,
  checkedInAt: IsoDateTime.nullish(),
  checkedInByUserId: z.uuid().nullish(),
});
export type Ticket = z.infer<typeof Ticket>;

export const RegisterInput = z.object({
  ticketTypeId: z.uuid(),
  quantity: z.number().int().gte(1).default(1),
  guestName: z.string().min(1).max(120),
  guestEmail: z.email(),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const RegisterResponse = z.object({
  registration: Registration,
  tickets: z.array(Ticket),
});
export type RegisterResponse = z.infer<typeof RegisterResponse>;

export const CheckInOutcome = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('ok'), ticket: Ticket, registration: Registration }),
  z.object({
    outcome: z.enum([
      'not_found',
      'wrong_event',
      'not_confirmed',
      'already_checked_in',
      'refunded',
    ]),
    code: OpaqueToken,
  }),
]);
export type CheckInOutcome = z.infer<typeof CheckInOutcome>;
