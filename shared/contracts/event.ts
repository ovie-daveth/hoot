import { z } from 'zod';

import { IsoDateTime, Slug } from './common';

export const EventFormat = z.enum(['online', 'offline']);
export type EventFormat = z.infer<typeof EventFormat>;

export const EventAdmission = z.enum(['free', 'paid']);
export type EventAdmission = z.infer<typeof EventAdmission>;

export const EventStatus = z.enum(['draft', 'published', 'completed', 'cancelled']);
export type EventStatus = z.infer<typeof EventStatus>;

export const Venue = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).nullish(),
  city: z.string().min(1).max(96).nullish(),
  placeId: z.string().min(1).max(255).nullish(),
  lat: z.number().gte(-90).lte(90).nullish(),
  lng: z.number().gte(-180).lte(180).nullish(),
  instructions: z.string().max(500).nullish(),
});
export type Venue = z.infer<typeof Venue>;

export const OnlineMeeting = z.object({
  provider: z.enum(['external']),
  url: z.url(),
  instructions: z.string().max(500).nullish(),
});
export type OnlineMeeting = z.infer<typeof OnlineMeeting>;

const eventObject = z.object({
  id: z.uuid(),
  slug: Slug,
  title: z.string().min(1).max(200),
  description: z.string().max(10_000),
  coverImageUrl: z.url().nullish(),
  organiserId: z.uuid(),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
  timezone: z.string().min(1).max(64).regex(/^[A-Za-z0-9_\-/+\s]+$/),
  format: EventFormat,
  admission: EventAdmission,
  status: EventStatus,
  capacity: z.number().int().gt(0).nullish(),
  registrationOpensAt: IsoDateTime.nullish(),
  registrationClosesAt: IsoDateTime.nullish(),
  venue: Venue.nullish(),
  onlineMeeting: OnlineMeeting.nullish(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export const Event = eventObject
  .refine((event) => Date.parse(event.endsAt) > Date.parse(event.startsAt), {
    error: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
  .refine((event) => event.format !== 'offline' || !!event.venue, {
    error: 'offline events require a venue',
    path: ['venue'],
  })
  .refine((event) => event.format !== 'online' || !!event.onlineMeeting, {
    error: 'online events require an online meeting configuration',
    path: ['onlineMeeting'],
  });
export type Event = z.infer<typeof Event>;

export const PublicEvent = eventObject.omit({ onlineMeeting: true });
export type PublicEvent = z.infer<typeof PublicEvent>;

export const EventUpsertInput = eventObject
  .omit({
    id: true,
    organiserId: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    slug: true,
  })
  .partial();
export type EventUpsertInput = z.infer<typeof EventUpsertInput>;

export const PublishEventInput = z.object({});
