import type { Event, LedgerEntry, Payment, Registration, Ticket, TicketType, Withdrawal } from '@shared/contracts';

const isoInDays = (days: number, hourUtc = 17, minute = 0): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hourUtc, minute, 0, 0);
  return date.toISOString();
};

const isoInMinutes = (minutes: number): string => {
  return new Date(Date.now() + minutes * 60_000).toISOString();
};

export const MOCK_ORGANISER_USER_ID = '0f8a2d64-6c5e-4b1a-9f3e-7a2c1d4b8e90' as const;

export const mockEvents: Event[] = [
  {
    id: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c',
    slug: 'design-systems-meetup-lagos',
    title: 'Design Systems Meetup Lagos',
    description:
      'An evening with product designers and front-end engineers building and scaling design systems in Nigerian tech companies. Talks, live critiques, and open floor Q&A.',
    coverImageUrl: 'https://images.mock.lumaclone.dev/design-systems-meetup.jpeg',
    organiserId: MOCK_ORGANISER_USER_ID,
    startsAt: isoInDays(6, 17),
    endsAt: isoInDays(6, 21),
    timezone: 'Africa/Lagos',
    format: 'offline',
    admission: 'free',
    status: 'published',
    capacity: 150,
    registrationOpensAt: isoInDays(-2, 9),
    registrationClosesAt: isoInDays(6, 16),
    venue: {
      name: 'Landmark Event Centre, Victoria Island',
      address: 'Water Corporation Road, Victoria Island, Lagos',
      placeId: 'ChIJmQxpXN-KOx4RgvSgtVh9vFo',
      lat: 6.4354,
      lng: 3.4631,
      instructions: 'Checkpoint 2 car park, use the Cooper Road entrance.',
    },
    createdAt: isoInDays(-20),
    updatedAt: isoInDays(-3),
  },
  {
    id: 'b2c3d4e5-f6a7-48b9-8c0d-2e3f4a5b6c7d',
    slug: 'remote-product-summit-2026',
    title: 'Remote Product Summit 2026',
    description:
      'A one-day virtual conference on distributed product teams. Live keynotes from senior PMs at global companies, plus Q&A and networking rooms.',
    coverImageUrl: 'https://images.mock.lumaclone.dev/remote-summit.jpeg',
    organiserId: MOCK_ORGANISER_USER_ID,
    startsAt: isoInDays(12, 10),
    endsAt: isoInDays(12, 16),
    timezone: 'Africa/Lagos',
    format: 'online',
    admission: 'paid',
    status: 'published',
    registrationOpensAt: isoInDays(-4, 9),
    registrationClosesAt: isoInDays(12, 8),
    onlineMeeting: {
      provider: 'external',
      url: 'https://zoom.us/j/98241736517?pwd=MOCKSAMPLE',
      instructions: 'Doors open 30 minutes before start. Sign in with your registration email.',
    },
    createdAt: isoInDays(-30),
    updatedAt: isoInDays(-4),
  },
  {
    id: 'c3d4e5f6-a7b8-49c0-a7b9-3f4a5b6c7d8e',
    slug: 'sunday-jollof-cook-along',
    title: 'Sunday Jollof Cook-Along',
    description:
      'Free online cook-along with chef Tunde. Grab your ingredients list from the event page and cook together live.',
    organiserId: MOCK_ORGANISER_USER_ID,
    startsAt: isoInDays(3, 15),
    endsAt: isoInDays(3, 17),
    timezone: 'Africa/Lagos',
    format: 'online',
    admission: 'free',
    status: 'published',
    onlineMeeting: {
      provider: 'external',
      url: 'https://meet.google.com/mock-here-ljkl',
    },
    createdAt: isoInDays(-10),
    updatedAt: isoInDays(-10),
  },
  {
    id: 'd4e5f6a7-b8c9-4a0f-8a0b-4a5b6c7d8e9f',
    slug: 'founders-dinner-lagos',
    title: 'Founders Dinner Lagos',
    description:
      'Intimate seated dinner for company founders. Curated guest list, three-course menu, and pitch-free conversation.',
    coverImageUrl: 'https://images.mock.lumaclone.dev/founders-dinner.jpeg',
    organiserId: MOCK_ORGANISER_USER_ID,
    startsAt: isoInDays(9, 18),
    endsAt: isoInDays(9, 22),
    timezone: 'Africa/Lagos',
    format: 'offline',
    admission: 'paid',
    status: 'published',
    capacity: 60,
    venue: {
      name: 'Nok by Zircon, Victoria Island',
      address: 'Plot 12a Block, Akin Adesola Street, Victoria Island, Lagos',
      lat: 6.4287,
      lng: 3.4257,
    },
    createdAt: isoInDays(-15),
    updatedAt: isoInDays(-2),
  },
  {
    id: 'e5f6a7b8-c9d0-4b6a-b8a5-5b6c7d8e9fa0',
    slug: 'lagos-builders-unconference-wip',
    title: 'Lagos Builders Unconference (WIP)',
    description:
      'Working title — agenda still in progress. Venue and pricing to be confirmed before publishing.',
    organiserId: MOCK_ORGANISER_USER_ID,
    startsAt: isoInDays(20, 16),
    endsAt: isoInDays(20, 20),
    timezone: 'Africa/Lagos',
    format: 'offline',
    admission: 'paid',
    status: 'draft',
    venue: null,
    createdAt: isoInDays(-1),
    updatedAt: isoInDays(-1),
  },
  {
    id: 'f6a7b8c9-d0e1-4c85-9dcb-6c7d8e9fa0b1',
    slug: 'product-analytics-bootcamp-2025',
    title: 'Product Analytics Bootcamp 2025',
    description: 'Archived edition of a past cohort. Kept for history; no new registrations.',
    organiserId: MOCK_ORGANISER_USER_ID,
    startsAt: isoInDays(-40, 9),
    endsAt: isoInDays(-40, 17),
    timezone: 'Africa/Lagos',
    format: 'online',
    admission: 'free',
    status: 'completed',
    onlineMeeting: {
      provider: 'external',
      url: 'https://meet.google.com/past-cohort-room',
    },
    createdAt: isoInDays(-90),
    updatedAt: isoInDays(-40),
  },
];

export const mockTicketTypes: TicketType[] = [
  {
    id: '2a1b0c9d-8e7f-4a6b-9c5d-1e2f3a4b5c6d',
    eventId: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c',
    name: 'General',
    description: 'Free entry. Register early — capacity is limited.',
    priceMinor: 0,
    currency: 'NGN',
    quantityTotal: 150,
    quantitySold: 37,
    salesStartsAt: isoInDays(-2, 9),
    salesEndsAt: isoInDays(6, 16),
    minPerOrder: 1,
    maxPerOrder: 4,
    isActive: true,
  },
  {
    id: '3b2c1d0e-9f8a-4b7c-8d6e-2f3a4b5c6d7e',
    eventId: 'b2c3d4e5-f6a7-48b9-8c0d-2e3f4a5b6c7d',
    name: 'Early bird',
    description: 'Limited quantity. Access to all sessions and recordings.',
    priceMinor: 250_000,
    currency: 'NGN',
    quantityTotal: 200,
    quantitySold: 40,
    salesStartsAt: isoInDays(-4, 9),
    salesEndsAt: isoInDays(5, 23),
    minPerOrder: 1,
    maxPerOrder: 6,
    isActive: true,
  },
  {
    id: '4c3d2e1f-0a9b-4c8d-9e7f-3a4b5c6d7e8f',
    eventId: 'b2c3d4e5-f6a7-48b9-8c0d-2e3f4a5b6c7d',
    name: 'Regular',
    description: 'Access to all sessions and recordings.',
    priceMinor: 400_000,
    currency: 'NGN',
    quantityTotal: 600,
    quantitySold: 1,
    salesEndsAt: isoInDays(12, 8),
    minPerOrder: 1,
    maxPerOrder: 6,
    isActive: true,
  },
  {
    id: '5d4e3f2a-1b0c-4d9e-8f6a-4b5c6d7e8f9a',
    eventId: 'd4e5f6a7-b8c9-4a0f-8a0b-4a5b6c7d8e9f',
    name: 'VIP table',
    description: 'Reserved table for two at the founders dinner.',
    priceMinor: 1_500_000,
    currency: 'NGN',
    quantityTotal: 60,
    quantitySold: 12,
    salesEndsAt: isoInDays(9, 17),
    minPerOrder: 1,
    maxPerOrder: 2,
    isActive: true,
  },
];

export const mockRegistrations: Registration[] = [
  {
    id: 'aa1bb2c3-d4e5-4f6a-8b7c-9d0e1f2a3b4c',
    eventId: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c',
    ticketTypeId: '2a1b0c9d-8e7f-4a6b-9c5d-1e2f3a4b5c6d',
    quantity: 1,
    grossMinor: 0,
    currency: 'NGN',
    status: 'confirmed',
    guestName: 'Amina Bello',
    guestEmail: 'amina.bello@example.com',
    createdAt: isoInDays(-1, 12),
  },
  {
    id: 'bb2cc3d4-e5f6-4a7b-a0c8-0e1f2a3b4c5d',
    eventId: 'b2c3d4e5-f6a7-48b9-8c0d-2e3f4a5b6c7d',
    ticketTypeId: '3b2c1d0e-9f8a-4b7c-8d6e-2f3a4b5c6d7e',
    quantity: 1,
    grossMinor: 250_000,
    currency: 'NGN',
    status: 'confirmed',
    guestName: 'Chidi Okafor',
    guestEmail: 'chidi.okafor@example.com',
    createdAt: isoInDays(-3, 15),
  },
];

export const mockTickets: Ticket[] = [
  {
    id: 'ee5ff6a7-8b9c-4d0e-a2e0-2a3b4c5d6e7f',
    eventId: 'a1b2c3d4-e5f6-47a8-9b0c-1d2e3f4a5b6c',
    registrationId: 'aa1bb2c3-d4e5-4f6a-8b7c-9d0e1f2a3b4c',
    code: 'T7KPX9RWMQZF4LX8VB3C',
    status: 'valid',
    issuedAt: isoInDays(-1, 12),
    checkedInAt: null,
    checkedInByUserId: null,
  },
  {
    id: 'ff6aa7b8-9c0d-4e1f-b3f1-3b4c5d6e7f80',
    eventId: 'b2c3d4e5-f6a7-48b9-8c0d-2e3f4a5b6c7d',
    registrationId: 'bb2cc3d4-e5f6-4a7b-a0c8-0e1f2a3b4c5d',
    code: 'R9MTQZF4LX8VB3C5D7KPX',
    status: 'valid',
    issuedAt: isoInDays(-3, 17),
    checkedInAt: null,
    checkedInByUserId: null,
  },
];

export const mockPayments: Payment[] = [
  {
    id: 'cc3dd4e5-f6a7-4b8c-b1d9-1f2a3b4c5d6e',
    eventId: 'b2c3d4e5-f6a7-48b9-8c0d-2e3f4a5b6c7d',
    registrationId: 'bb2cc3d4-e5f6-4a7b-a0c8-0e1f2a3b4c5d',
    provider: 'monnify',
    providerReference: 'MON-8HXK2BQE9R',
    amountMinor: 250_000,
    currency: 'NGN',
    status: 'success',
    feeMinor: 4_750,
    commissionRateBps: 500,
    commissionMinor: 12_500,
    createdAt: isoInDays(-3, 15),
    paidAt: isoInDays(-3, 17),
  },
];

export const mockLedgerEntries: LedgerEntry[] = [
  {
    id: 'dd4ee5f6-a7b8-4c9d-0e1f-8a1b2c3d4e5f',
    createdAt: isoInDays(-3, 15),
    type: 'GROSS_PAYMENT',
    direction: 'credit',
    amountMinor: 250_000,
    currency: 'NGN',
    organiserId: MOCK_ORGANISER_USER_ID,
    eventId: 'b2c3d4e5-f6a7-48b9-8c0d-2e3f4a5b6c7d',
    registrationId: 'bb2cc3d4-e5f6-4a7b-a0c8-0e1f2a3b4c5d',
    paymentId: 'cc3dd4e5-f6a7-4b8c-b1d9-1f2a3b4c5d6e',
    runningPayableMinor: 250_000,
  },
  {
    id: 'ed5ff6a7-b8c9-4d0e-8a1b-9b2c3d4e5f6a',
    createdAt: isoInDays(-3, 16),
    type: 'PLATFORM_COMMISSION',
    direction: 'debit',
    amountMinor: 12_500,
    currency: 'NGN',
    organiserId: MOCK_ORGANISER_USER_ID,
    eventId: 'b2c3d4e5-f6a7-48b9-8c0d-2e3f4a5b6c7d',
    registrationId: 'bb2cc3d4-e5f6-4a7b-a0c8-0e1f2a3b4c5d',
    paymentId: 'cc3dd4e5-f6a7-4b8c-b1d9-1f2a3b4c5d6e',
    runningPayableMinor: 237_500,
    note: 'Platform commission at 5.00%',
  },
  {
    id: 'fe6aa7b8-c9d0-4e1f-8b2c-0c3d4e5f6a7b',
    createdAt: isoInDays(-3, 17),
    type: 'PROCESSING_FEE',
    direction: 'debit',
    amountMinor: 4_750,
    currency: 'NGN',
    organiserId: MOCK_ORGANISER_USER_ID,
    eventId: 'b2c3d4e5-f6a7-48b9-8c0d-2e3f4a5b6c7d',
    registrationId: 'bb2cc3d4-e5f6-4a7b-a0c8-0e1f2a3b4c5d',
    paymentId: 'cc3dd4e5-f6a7-4b8c-b1d9-1f2a3b4c5d6e',
    runningPayableMinor: 232_750,
    note: 'Provider processing charge (organiser-borne)',
  },
  {
    id: '0a7b8c9d-0e1f-4f2a-9c03-4c5d6e7f8091',
    createdAt: isoInDays(-2, 10),
    type: 'PAYOUT',
    direction: 'debit',
    amountMinor: 200_000,
    currency: 'NGN',
    organiserId: MOCK_ORGANISER_USER_ID,
    withdrawalId: '1b8c9d0e-1f2a-4a3b-8d14-5d6e7f8091a2',
    runningPayableMinor: 32_750,
  },
  {
    id: '2b9c0d1e-2f3a-4b4c-9e25-6e7f8091a2b3',
    createdAt: isoInDays(-2, 11),
    type: 'TRANSFER_FEE',
    direction: 'debit',
    amountMinor: 10_000,
    currency: 'NGN',
    organiserId: MOCK_ORGANISER_USER_ID,
    withdrawalId: '1b8c9d0e-1f2a-4a3b-8d14-5d6e7f8091a2',
    runningPayableMinor: 22_750,
  },
];

export const mockWithdrawals: Withdrawal[] = [
  {
    id: '1b8c9d0e-1f2a-4a3b-8d14-5d6e7f8091a2',
    organiserId: MOCK_ORGANISER_USER_ID,
    amountMinor: 200_000,
    currency: 'NGN',
    feeMinor: 10_000,
    destination: {
      bankName: 'Guaranty Trust Bank',
      bankCode: '058',
      accountNumber: '0123456789',
      accountName: 'Okonkwo Ventures',
    },
    status: 'paid',
    providerTransferReference: 'TRF-9ZK3HXD2',
    createdAt: isoInDays(-2, 10),
    paidAt: isoInDays(-2, 11),
  },
];

export const MOCK_HOLD_MINUTES = 15;
export const MOCK_LATENCY_MS = 300;
export const MOCK_SIMULATED_WEBHOOK_MS = 1_500;

export function mockIsoHoldExpiry(): string {
  return isoInMinutes(MOCK_HOLD_MINUTES);
}

export { isoInDays as mockIsoInDays };
