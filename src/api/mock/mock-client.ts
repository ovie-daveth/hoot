import { ApiError } from '@shared/errors';
import {
  COMMISSION_RATE_BPS_DEFAULT,
  addMoney,
  calculatePlatformCommission,
  subtractMoney,
} from '@shared/money';
import {
  Event,
  LedgerEntry as LedgerEntrySchema,
  OrganiserBalance as OrganiserBalanceSchema,
  Payment as PaymentSchema,
  PublicEvent as PublicEventSchema,
  Registration as RegistrationSchema,
  Ticket as TicketSchema,
  TicketType as TicketTypeSchema,
  Withdrawal as WithdrawalSchema,
  type CheckInOutcome,
  type EventUpsertInput,
  type LedgerEntry,
  type OrganiserBalance,
  type Payment,
  type PublicEvent,
  type RegisterInput,
  type RegisterResponse,
  type Registration,
  type StartPaymentResponse,
  type Ticket,
  type TicketType,
  type Withdrawal,
  type WithdrawalRequestInput,
  type BankVerification,
} from '@shared/contracts';
import type {
  ApiClient,
  AttendeeListEntry,
  BankSummary,
  CreateTicketTypeInput,
  EventFilters,
  UpdateTicketTypeInput,
} from '@/api/types';
import {
  MOCK_LATENCY_MS,
  MOCK_ORGANISER_USER_ID,
  MOCK_SIMULATED_WEBHOOK_MS,
  mockEvents,
  mockIsoHoldExpiry,
  mockLedgerEntries,
  mockPayments,
  mockRegistrations,
  mockTicketTypes,
  mockTickets,
  mockWithdrawals,
} from './data';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const uuid4 = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
const opaqueToken = (length = 20): string => {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
  }
  return out;
};
const slugify = (title: string): string => {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
  return `${base || 'event'}-${opaqueToken(6).toLowerCase()}`;
};

const publicEvents = (): PublicEvent[] =>
  mockEvents.filter((event) => event.status === 'published').map((event) => PublicEventSchema.parse(event));

const activeHolds = (ticketTypeId: string): number => {
  const now = Date.now();
  return mockRegistrations
    .filter(
      (registration) =>
        registration.ticketTypeId === ticketTypeId &&
        registration.status === 'pending' &&
        registration.holdExpiresAt !== null &&
        registration.holdExpiresAt !== undefined &&
        Date.parse(registration.holdExpiresAt) > now,
    )
    .reduce((total, registration) => total + registration.quantity, 0);
};

const remainingFor = (ticketType: TicketType): number =>
  Math.max(0, ticketType.quantityTotal - ticketType.quantitySold - activeHolds(ticketType.id));

const latestRunningPayable = (): number | null => {
  return mockLedgerEntries[mockLedgerEntries.length - 1]?.runningPayableMinor ?? null;
};

const addLedgerEntry = (
  entry: Pick<
    LedgerEntry,
    'type' | 'direction' | 'amountMinor' | 'organiserId' | 'eventId' | 'registrationId' | 'paymentId' | 'withdrawalId' | 'note'
  >,
  runningPayableMinor: number | null,
): void => {
  mockLedgerEntries.push(
    LedgerEntrySchema.parse({
      ...entry,
      id: uuid4(),
      createdAt: new Date().toISOString(),
      runningPayableMinor,
    }),
  );
};

const computeOrganiserBalance = (): OrganiserBalance => {
  const byType = (type: LedgerEntry['type'], direction: 'credit' | 'debit') =>
    mockLedgerEntries
      .filter((entry) => entry.type === type && entry.direction === direction)
      .reduce((total, entry) => total + entry.amountMinor, 0);
  const credits = mockLedgerEntries
    .filter((entry) => entry.direction === 'credit')
    .reduce((total, entry) => total + entry.amountMinor, 0);
  const debits = mockLedgerEntries
    .filter((entry) => entry.direction === 'debit')
    .reduce((total, entry) => total + entry.amountMinor, 0);
  return OrganiserBalanceSchema.parse({
    organiserId: MOCK_ORGANISER_USER_ID,
    currency: 'NGN',
    grossSalesMinor: byType('GROSS_PAYMENT', 'credit'),
    platformCommissionMinor: byType('PLATFORM_COMMISSION', 'debit'),
    processingFeesMinor: byType('PROCESSING_FEE', 'debit'),
    refundsMinor: byType('REFUND', 'debit'),
    payoutsMinor: byType('PAYOUT', 'debit'),
    transferFeesMinor: byType('TRANSFER_FEE', 'debit'),
    adjustmentsMinor: byType('ADJUSTMENT', 'credit') - byType('ADJUSTMENT', 'debit'),
    payableMinor: credits - debits,
    pendingWithdrawalMinor: mockWithdrawals
      .filter((withdrawal) => withdrawal.status === 'requested' || withdrawal.status === 'processing')
      .reduce((total, withdrawal) => total + withdrawal.amountMinor, 0),
    asOf: new Date().toISOString(),
  });
};

const issueTickets = (registration: Registration): Ticket[] => {
  const created: Ticket[] = [];
  for (let i = 0; i < registration.quantity; i++) {
    const ticket = TicketSchema.parse({
      id: uuid4(),
      eventId: registration.eventId,
      registrationId: registration.id,
      code: opaqueToken(),
      status: 'valid',
      issuedAt: new Date().toISOString(),
      checkedInAt: null,
      checkedInByUserId: null,
    });
    mockTickets.push(ticket);
    created.push(ticket);
  }
  return created;
};

const sellQuantity = (ticketType: TicketType, quantity: number): void => {
  const index = mockTicketTypes.indexOf(ticketType);
  mockTicketTypes.splice(
    index,
    1,
    TicketTypeSchema.parse({ ...ticketType, quantitySold: ticketType.quantitySold + quantity }),
  );
};

const simulateProviderWebhook = (
  payment: Payment,
  registration: Registration,
  ticketType: TicketType,
): void => {
  setTimeout(() => {
    const paymentIndex = mockPayments.findIndex(
      (candidate) => candidate.id === payment.id && candidate.status === 'pending',
    );
    if (paymentIndex < 0) return;
    const pending = mockPayments[paymentIndex];
    const feeMinor = Math.min(200_000, Math.floor(pending.amountMinor * 0.015) + 10_000);
    const commissionMinor = calculatePlatformCommission(pending.amountMinor, pending.commissionRateBps);
    const settled = PaymentSchema.parse({
      ...pending,
      status: 'success',
      feeMinor,
      commissionMinor,
      paidAt: new Date().toISOString(),
    });
    mockPayments.splice(paymentIndex, 1, settled);

    const registrationIndex = mockRegistrations.findIndex(
      (candidate) => candidate.id === registration.id,
    );
    const confirmedRegistration = RegistrationSchema.parse({
      ...registration,
      status: 'confirmed',
    });
    mockRegistrations.splice(registrationIndex, 1, confirmedRegistration);
    sellQuantity(ticketType, registration.quantity);
    issueTickets(confirmedRegistration);

    const previous = latestRunningPayable() ?? 0;
    const afterGross = addMoney(previous, settled.amountMinor);
    const afterCommission = subtractMoney(afterGross, commissionMinor);
    const afterFee = subtractMoney(afterCommission, feeMinor);
    addLedgerEntry(
      {
        type: 'GROSS_PAYMENT',
        direction: 'credit',
        amountMinor: settled.amountMinor,
        organiserId: MOCK_ORGANISER_USER_ID,
        eventId: settled.eventId,
        registrationId: settled.registrationId,
        paymentId: settled.id,
        withdrawalId: null,
        note: null,
      },
      afterGross,
    );
    addLedgerEntry(
      {
        type: 'PLATFORM_COMMISSION',
        direction: 'debit',
        amountMinor: commissionMinor,
        organiserId: MOCK_ORGANISER_USER_ID,
        eventId: settled.eventId,
        registrationId: settled.registrationId,
        paymentId: settled.id,
        withdrawalId: null,
        note: `Platform commission at ${(settled.commissionRateBps / 100).toFixed(2)}%`,
      },
      afterCommission,
    );
    addLedgerEntry(
      {
        type: 'PROCESSING_FEE',
        direction: 'debit',
        amountMinor: feeMinor,
        organiserId: MOCK_ORGANISER_USER_ID,
        eventId: settled.eventId,
        registrationId: settled.registrationId,
        paymentId: settled.id,
        withdrawalId: null,
        note: 'Provider processing charge (organiser-borne)',
      },
      afterFee,
    );

    console.info(
      `[mock api] simulated server-side webhook settled payment ${settled.providerReference} (verified flow, client was not involved)`,
    );
  }, MOCK_SIMULATED_WEBHOOK_MS);
};

const assertPublished = (event: Event | undefined): Event => {
  if (!event || event.status !== 'published') {
    throw new ApiError({ code: 'not_found', message: 'Event not found' });
  }
  return event;
};

const assertOwnedEvent = (eventId: string): Event => {
  const event = mockEvents.find((candidate) => candidate.id === eventId);
  if (!event) throw new ApiError({ code: 'not_found', message: 'Event not found' });
  return event;
};

const requireUpsertTitle = (input: EventUpsertInput): string => {
  if (!input.title) {
    throw new ApiError({ code: 'validation', message: 'Event title is required' });
  }
  return input.title;
};

export function createMockApiClient(): ApiClient {
  return {
    async getEvents(filters: EventFilters = {}): Promise<PublicEvent[]> {
      await sleep(MOCK_LATENCY_MS);
      const query = filters.query?.toLocaleLowerCase().trim() ?? '';
      return publicEvents().filter((event) => {
        const matchesQuery = query.length === 0 || event.title.toLocaleLowerCase().includes(query);
        const matchesFormat = !filters.format || event.format === filters.format;
        const matchesAdmission = !filters.admission || event.admission === filters.admission;
        return matchesQuery && matchesFormat && matchesAdmission;
      });
    },

    async getEventBySlug(slug: string): Promise<PublicEvent> {
      await sleep(MOCK_LATENCY_MS);
      const event = mockEvents.find((candidate) => candidate.slug === slug);
      assertPublished(event);
      return PublicEventSchema.parse(event);
    },

    async getTicketTypes(eventId: string): Promise<TicketType[]> {
      await sleep(MOCK_LATENCY_MS);
      return mockTicketTypes
        .filter((ticketType) => ticketType.eventId === eventId && ticketType.isActive)
        .map((ticketType) => TicketTypeSchema.parse(ticketType));
    },

    async createEvent(input: EventUpsertInput): Promise<Event> {
      await sleep(MOCK_LATENCY_MS);
      const now = new Date().toISOString();
      const draft = Event.parse({
        id: uuid4(),
        slug: slugify(requireUpsertTitle(input)),
        title: input.title,
        description: input.description ?? '',
        coverImageUrl: input.coverImageUrl ?? null,
        organiserId: MOCK_ORGANISER_USER_ID,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        timezone: input.timezone ?? 'Africa/Lagos',
        format: input.format ?? 'offline',
        admission: input.admission ?? 'free',
        status: 'draft',
        capacity: input.capacity ?? null,
        registrationOpensAt: input.registrationOpensAt ?? null,
        registrationClosesAt: input.registrationClosesAt ?? null,
        venue: input.venue ?? null,
        onlineMeeting: input.onlineMeeting ?? null,
        createdAt: now,
        updatedAt: now,
      });
      mockEvents.push(draft);
      return draft;
    },

    async updateEvent(eventId: string, input: EventUpsertInput): Promise<Event> {
      await sleep(MOCK_LATENCY_MS);
      const event = assertOwnedEvent(eventId);
      const index = mockEvents.indexOf(event);
      const updated = Event.parse({ ...event, ...input, updatedAt: new Date().toISOString() });
      mockEvents.splice(index, 1, updated);
      return updated;
    },

    async publishEvent(eventId: string): Promise<Event> {
      await sleep(MOCK_LATENCY_MS);
      const event = assertOwnedEvent(eventId);
      if (event.format === 'offline' && !event.venue) {
        throw new ApiError({ code: 'validation', message: 'Offline events need a venue before publishing' });
      }
      if (event.format === 'online' && !event.onlineMeeting) {
        throw new ApiError({ code: 'validation', message: 'Online events need a meeting link before publishing' });
      }
      const hasTicket = mockTicketTypes.some(
        (ticketType) =>
          ticketType.eventId === event.id && ticketType.isActive && ticketType.quantityTotal > 0,
      );
      if (event.admission === 'paid' && !hasTicket) {
        throw new ApiError({
          code: 'validation',
          message: 'Paid events need at least one active ticket type before publishing',
        });
      }
      const index = mockEvents.indexOf(event);
      const published = Event.parse({ ...event, status: 'published', updatedAt: new Date().toISOString() });
      mockEvents.splice(index, 1, published);
      return published;
    },

    async cancelEvent(eventId: string): Promise<Event> {
      await sleep(MOCK_LATENCY_MS);
      const event = assertOwnedEvent(eventId);
      const index = mockEvents.indexOf(event);
      const cancelled = Event.parse({ ...event, status: 'cancelled', updatedAt: new Date().toISOString() });
      mockEvents.splice(index, 1, cancelled);
      return cancelled;
    },

    async createTicketType(eventId: string, input: CreateTicketTypeInput): Promise<TicketType> {
      await sleep(MOCK_LATENCY_MS);
      assertOwnedEvent(eventId);
      const ticketType = TicketTypeSchema.parse({
        ...input,
        id: uuid4(),
        eventId,
        quantitySold: 0,
      });
      mockTicketTypes.push(ticketType);
      return ticketType;
    },

    async updateTicketType(id: string, input: UpdateTicketTypeInput): Promise<TicketType> {
      await sleep(MOCK_LATENCY_MS);
      const ticketType = mockTicketTypes.find((candidate) => candidate.id === id);
      if (!ticketType) throw new ApiError({ code: 'not_found', message: 'Ticket type not found' });
      if (
        input.quantityTotal !== undefined &&
        input.quantityTotal < ticketType.quantitySold
      ) {
        throw new ApiError({
          code: 'validation',
          message: 'Quantity cannot go below tickets already sold',
        });
      }
      const index = mockTicketTypes.indexOf(ticketType);
      const updated = TicketTypeSchema.parse({ ...ticketType, ...input });
      mockTicketTypes.splice(index, 1, updated);
      return updated;
    },

    async register(eventId: string, input: RegisterInput): Promise<RegisterResponse> {
      await sleep(MOCK_LATENCY_MS);
      const event = assertPublished(mockEvents.find((candidate) => candidate.id === eventId));
      const ticketType = mockTicketTypes.find((candidate) => candidate.id === input.ticketTypeId);
      if (!ticketType || ticketType.eventId !== event.id) {
        throw new ApiError({ code: 'validation', message: 'Ticket type is not available for this event' });
      }
      const now = Date.now();
      if (ticketType.salesStartsAt && Date.parse(ticketType.salesStartsAt) > now) {
        throw new ApiError({ code: 'validation', message: 'Sales have not opened yet' });
      }
      if (ticketType.salesEndsAt && Date.parse(ticketType.salesEndsAt) < now) {
        throw new ApiError({ code: 'validation', message: 'Sales have closed' });
      }
      if (input.quantity < ticketType.minPerOrder || input.quantity > ticketType.maxPerOrder) {
        throw new ApiError({
          code: 'validation',
          message: `Quantity must be between ${ticketType.minPerOrder} and ${ticketType.maxPerOrder}`,
        });
      }
      if (remainingFor(ticketType) < input.quantity) {
        throw new ApiError({ code: 'conflict', message: 'Not enough tickets left' });
      }

      const isPaid = event.admission === 'paid' && ticketType.priceMinor > 0;
      const registration = RegistrationSchema.parse({
        id: uuid4(),
        eventId: event.id,
        ticketTypeId: ticketType.id,
        quantity: input.quantity,
        grossMinor: isPaid ? ticketType.priceMinor * input.quantity : 0,
        currency: ticketType.currency,
        status: isPaid ? 'pending' : 'confirmed',
        userId: null,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        holdExpiresAt: isPaid ? mockIsoHoldExpiry() : null,
        createdAt: new Date().toISOString(),
      });
      mockRegistrations.push(registration);

      if (!isPaid) {
        sellQuantity(ticketType, input.quantity);
        const tickets = issueTickets(registration);
        return {
          registration: RegistrationSchema.parse(
            mockRegistrations[mockRegistrations.length - 1],
          ),
          tickets,
        };
      }
      return { registration, tickets: [] };
    },

    async getRegistration(registrationId: string): Promise<Registration> {
      await sleep(MOCK_LATENCY_MS);
      const registration = mockRegistrations.find((candidate) => candidate.id === registrationId);
      if (!registration) throw new ApiError({ code: 'not_found', message: 'Registration not found' });
      return RegistrationSchema.parse(registration);
    },

    async startPayment(registrationId: string): Promise<StartPaymentResponse> {
      await sleep(MOCK_LATENCY_MS);
      const registration = mockRegistrations.find((candidate) => candidate.id === registrationId);
      if (!registration) throw new ApiError({ code: 'not_found', message: 'Registration not found' });
      if (registration.status !== 'pending') {
        throw new ApiError({ code: 'conflict', message: 'This registration is not awaiting payment' });
      }
      const existing = mockPayments.find((candidate) => candidate.registrationId === registrationId);
      if (existing && existing.status !== 'failed') {
        return {
          payment: PaymentSchema.parse(existing),
          checkoutUrl: `https://checkout.pay.mock/~${existing.providerReference}`,
        };
      }
      const payment = PaymentSchema.parse({
        id: uuid4(),
        eventId: registration.eventId,
        registrationId,
        provider: 'monnify',
        providerReference: `MON-${opaqueToken(12).toUpperCase()}`,
        amountMinor: registration.grossMinor,
        currency: registration.currency,
        status: 'pending',
        feeMinor: null,
        commissionRateBps: COMMISSION_RATE_BPS_DEFAULT,
        commissionMinor: null,
        createdAt: new Date().toISOString(),
        paidAt: null,
      });
      mockPayments.push(payment);
      const ticketType = mockTicketTypes.find((candidate) => candidate.id === registration.ticketTypeId);
      if (ticketType) {
        simulateProviderWebhook(payment, registration, ticketType);
      }
      return { payment, checkoutUrl: `https://checkout.pay.mock/~${payment.providerReference}` };
    },

    async getPayment(registrationId: string): Promise<Payment | null> {
      await sleep(MOCK_LATENCY_MS);
      const payment = mockPayments.find((candidate) => candidate.registrationId === registrationId);
      return payment ? PaymentSchema.parse(payment) : null;
    },

    async getTickets(): Promise<Ticket[]> {
      await sleep(MOCK_LATENCY_MS);
      return mockTickets
        .filter((ticket) => ticket.status !== 'cancelled')
        .map((ticket) => TicketSchema.parse(ticket));
    },

    async getTicketByToken(token: string): Promise<Ticket> {
      await sleep(MOCK_LATENCY_MS);
      const ticket = mockTickets.find((candidate) => candidate.code === token);
      if (!ticket) throw new ApiError({ code: 'not_found', message: 'Ticket not found' });
      return TicketSchema.parse(ticket);
    },

    async checkIn(eventId: string, code: string): Promise<CheckInOutcome> {
      await sleep(MOCK_LATENCY_MS);
      const token = code.trim();
      const ticket = mockTickets.find((candidate) => candidate.code === token);
      if (!ticket) return { outcome: 'not_found', code: token };
      if (ticket.eventId !== eventId) return { outcome: 'wrong_event', code: ticket.code };
      if (ticket.status === 'refunded' || ticket.status === 'cancelled') {
        return { outcome: 'refunded', code: ticket.code };
      }
      if (ticket.status === 'checked_in') {
        return { outcome: 'already_checked_in', code: ticket.code };
      }
      const registration = mockRegistrations.find((candidate) => candidate.id === ticket.registrationId);
      if (!registration || registration.status !== 'confirmed') {
        return { outcome: 'not_confirmed', code: ticket.code };
      }
      const checkedInTicket = TicketSchema.parse({
        ...ticket,
        status: 'checked_in',
        checkedInAt: new Date().toISOString(),
        checkedInByUserId: MOCK_ORGANISER_USER_ID,
      });
      mockTickets.splice(mockTickets.indexOf(ticket), 1, checkedInTicket);
      const checkedInRegistration = RegistrationSchema.parse({
        ...registration,
        status: 'checked_in',
      });
      mockRegistrations.splice(mockRegistrations.indexOf(registration), 1, checkedInRegistration);
      return { outcome: 'ok', ticket: checkedInTicket, registration: checkedInRegistration };
    },

    async getMyEvents(): Promise<Event[]> {
      await sleep(MOCK_LATENCY_MS);
      return [...mockEvents]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .map((event) => Event.parse(event));
    },

    async getEventAttendees(eventId: string): Promise<AttendeeListEntry[]> {
      await sleep(MOCK_LATENCY_MS);
      assertOwnedEvent(eventId);
      return mockRegistrations
        .filter((registration) => registration.eventId === eventId)
        .map((registration) => ({
          registration: RegistrationSchema.parse(registration),
          tickets: mockTickets
            .filter((ticket) => ticket.registrationId === registration.id)
            .map((ticket) => TicketSchema.parse(ticket)),
        }));
    },

    async getLedgerEntries(): Promise<LedgerEntry[]> {
      await sleep(MOCK_LATENCY_MS);
      return [...mockLedgerEntries]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map((entry) => LedgerEntrySchema.parse(entry));
    },

    async getOrganiserBalance(): Promise<OrganiserBalance> {
      await sleep(MOCK_LATENCY_MS);
      return computeOrganiserBalance();
    },

    async getWithdrawals(): Promise<Withdrawal[]> {
      await sleep(MOCK_LATENCY_MS);
      return [...mockWithdrawals]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map((withdrawal) => WithdrawalSchema.parse(withdrawal));
    },

    async requestWithdrawal(input: WithdrawalRequestInput): Promise<Withdrawal> {
      await sleep(MOCK_LATENCY_MS);
      const balance = computeOrganiserBalance();
      const available = balance.payableMinor - balance.pendingWithdrawalMinor;
      if (available < input.amountMinor) {
        throw new ApiError({ code: 'validation', message: 'Amount exceeds the withdrawal-eligible balance' });
      }
      const withdrawal = WithdrawalSchema.parse({
        id: uuid4(),
        organiserId: MOCK_ORGANISER_USER_ID,
        amountMinor: input.amountMinor,
        currency: 'NGN',
        feeMinor: 10_000,
        destination: input.destination,
        status: 'requested',
        providerTransferReference: null,
        failureReason: null,
        createdAt: new Date().toISOString(),
        paidAt: null,
      });
      mockWithdrawals.push(withdrawal);
      setTimeout(() => {
        const index = mockWithdrawals.findIndex((candidate) => candidate.id === withdrawal.id);
        if (index >= 0 && mockWithdrawals[index].status === 'requested') {
          mockWithdrawals.splice(
            index,
            1,
            WithdrawalSchema.parse({ ...mockWithdrawals[index], status: 'processing' }),
          );
        }
      }, 3_000);
      setTimeout(() => {
        const index = mockWithdrawals.findIndex((candidate) => candidate.id === withdrawal.id);
        if (index >= 0 && mockWithdrawals[index].status === 'processing') {
          mockWithdrawals.splice(
            index,
            1,
            WithdrawalSchema.parse({
              ...mockWithdrawals[index],
              status: 'paid',
              providerTransferReference: `TRF-${opaqueToken(8).toUpperCase()}`,
              paidAt: new Date().toISOString(),
            }),
          );
        }
      }, 6_000);
      return withdrawal;
    },

    async listBanks(): Promise<BankSummary[]> {
      await sleep(MOCK_LATENCY_MS);
      return [
        { bankCode: '058', bankName: 'Guaranty Trust Bank' },
        { bankCode: '044', bankName: 'Access Bank' },
        { bankCode: '057', bankName: 'Zenith Bank' },
        { bankCode: '033', bankName: 'United Bank for Africa' },
        { bankCode: '50515', bankName: 'Moniepoint MFB' },
        { bankCode: '999992', bankName: 'OPay' },
      ];
    },

    async verifyBankAccount(input: { bankCode: string; accountNumber: string }): Promise<BankVerification> {
      await sleep(MOCK_LATENCY_MS);
      if (!/^\d{6,12}$/.test(input.accountNumber)) {
        throw new ApiError({ code: 'validation', message: 'Account number is not valid' });
      }
      const digits = input.accountNumber.split('').reduce((sum, d) => sum + Number(d), 0);
      return { verified: true, accountName: digits % 2 === 0 ? 'ADEDAMOLA OJO' : 'FAITH OJO' };
    },
  };
}

export const mockApiClient = createMockApiClient();
