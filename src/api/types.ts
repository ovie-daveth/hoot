import type {
  BankVerification,
  CheckInOutcome,
  Event,
  EventAdmission,
  EventFormat,
  EventUpsertInput,
  LedgerEntry,
  OrganiserBalance,
  Payment,
  PublicEvent,
  RegisterInput,
  RegisterResponse,
  Registration,
  StartPaymentResponse,
  Ticket,
  TicketType,
  Withdrawal,
  WithdrawalRequestInput,
} from '@shared/contracts';

export type { BankVerification };

export type EventFilters = {
  query?: string;
  format?: EventFormat;
  admission?: EventAdmission;
};

export type AttendeeListEntry = {
  registration: Registration;
  tickets: Ticket[];
};

export type BankSummary = {
  bankCode: string;
  bankName: string;
};

export type CreateTicketTypeInput = Omit<TicketType, 'id' | 'eventId' | 'quantitySold'>;

export type UpdateTicketTypeInput = Partial<CreateTicketTypeInput>;

export interface ApiClient {
  getEvents(filters?: EventFilters): Promise<PublicEvent[]>;
  getEventBySlug(slug: string): Promise<PublicEvent>;
  getTicketTypes(eventId: string): Promise<TicketType[]>;
  createEvent(input: EventUpsertInput): Promise<Event>;
  updateEvent(eventId: string, input: EventUpsertInput): Promise<Event>;
  publishEvent(eventId: string): Promise<Event>;
  cancelEvent(eventId: string): Promise<Event>;
  createTicketType(eventId: string, input: CreateTicketTypeInput): Promise<TicketType>;
  updateTicketType(id: string, input: UpdateTicketTypeInput): Promise<TicketType>;
  register(eventId: string, input: RegisterInput): Promise<RegisterResponse>;
  getRegistration(registrationId: string): Promise<Registration>;
  startPayment(registrationId: string): Promise<StartPaymentResponse>;
  getPayment(registrationId: string): Promise<Payment | null>;
  getTickets(): Promise<Ticket[]>;
  getTicketByToken(token: string): Promise<Ticket>;
  checkIn(eventId: string, code: string): Promise<CheckInOutcome>;
  getMyEvents(): Promise<Event[]>;
  getEventAttendees(eventId: string): Promise<AttendeeListEntry[]>;
  getLedgerEntries(): Promise<LedgerEntry[]>;
  getOrganiserBalance(): Promise<OrganiserBalance>;
  getWithdrawals(): Promise<Withdrawal[]>;
  requestWithdrawal(input: WithdrawalRequestInput): Promise<Withdrawal>;
  listBanks(): Promise<BankSummary[]>;
  verifyBankAccount(input: { bankCode: string; accountNumber: string }): Promise<BankVerification>;
}
