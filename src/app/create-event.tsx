import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useCreateEventMutation, useMyEvents, usePublishEventMutation, useUpdateEventMutation } from '@/api/queries/events';
import {
  useCreateTicketTypeMutation,
  useTicketTypes,
  useUpdateTicketTypeMutation,
} from '@/api/queries/tickets';
import type { CreateTicketTypeInput } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { StepDots } from '@/components/ui/step-dots';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  EventUpsertInput,
  OnlineMeeting,
  TicketTypeUpsertInput,
  Venue,
  type Event,
} from '@shared/contracts';
import { toApiError } from '@shared/errors';

type StepId = 'basic' | 'date' | 'format' | 'location' | 'admission' | 'tickets' | 'capacity' | 'review';

type TicketDraft = {
  id?: string;
  localId: string;
  name: string;
  description: string;
  price: string;
  quantity: string;
};

type EventDraft = {
  title: string;
  description: string;
  coverImageUrl: string;
  coverVideoUrl: string;
  coverMediaType: 'image' | 'video' | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  format: 'online' | 'offline';
  venueName: string;
  venueAddress: string;
  venueCity: string;
  placeId: string;
  latitude: string;
  longitude: string;
  venueInstructions: string;
  meetingUrl: string;
  meetingInstructions: string;
  admission: 'free' | 'paid';
  capacity: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
};

const timezoneDefault = 'Africa/Lagos';

const makeTicketDraft = (): TicketDraft => ({
  localId: `ticket-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: '',
  description: '',
  price: '',
  quantity: '',
});

const makeInitialDraft = (): EventDraft => {
  const startsAt = formatInTimeZone(new Date(Date.now() + 24 * 60 * 60 * 1000), timezoneDefault, "yyyy-MM-dd'T'HH:mm");
  const endsAt = formatInTimeZone(new Date(Date.now() + 26 * 60 * 60 * 1000), timezoneDefault, "yyyy-MM-dd'T'HH:mm");
  return {
    title: '',
    description: '',
    coverImageUrl: '',
    coverVideoUrl: '',
    coverMediaType: null,
    startsAt,
    endsAt,
    timezone: timezoneDefault,
    format: 'offline',
    venueName: '',
    venueAddress: '',
    venueCity: '',
    placeId: '',
    latitude: '',
    longitude: '',
    venueInstructions: '',
    meetingUrl: '',
    meetingInstructions: '',
    admission: 'free',
    capacity: '',
    registrationOpensAt: '',
    registrationClosesAt: '',
  };
};

const BASIC_INFO = z.object({
  title: z.string().trim().min(1, 'Enter an event title').max(200, 'Title must be 200 characters or fewer'),
  description: z.string().max(10_000, 'Description must be 10,000 characters or fewer'),
  coverImageUrl: z.string(),
  coverVideoUrl: z.string(),
  coverMediaType: z.enum(['image', 'video']).nullable(),
}).superRefine((value, context) => {
  const mediaUrl = value.coverMediaType === 'video' ? value.coverVideoUrl : value.coverImageUrl;
  if (mediaUrl && !z.url().safeParse(mediaUrl).success) {
    context.addIssue({ code: 'custom', path: ['coverImageUrl'], message: 'Enter a valid media URL' });
  }
  if (value.coverMediaType === 'video' && mediaUrl && !mediaUrl.startsWith('file:') && !mediaUrl.startsWith('https:')) {
    context.addIssue({ code: 'custom', path: ['coverVideoUrl'], message: 'Use a secure HTTPS video link' });
  }
});

const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function toIsoDateTime(value: string, timezone: string, label: string, optional = false): string | null {
  if (!value.trim() && optional) return null;
  if (!localDateTimePattern.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DDTHH:mm format`);
  }
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    throw new Error(`${label} is not a valid date and time`);
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    const result = fromZonedTime(`${date} ${time}`, timezone);
    if (Number.isNaN(result.getTime())) throw new Error();
    return result.toISOString();
  } catch {
    throw new Error('Enter a valid IANA timezone, for example Africa/Lagos');
  }
}

function parseOptionalCount(value: string, label: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d+$/.test(value.trim())) throw new Error(`${label} must be a whole number`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${label} must be greater than zero`);
  }
  return number;
}

function parseNairaToKobo(value: string): number {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Ticket price must be a non-negative NGN amount with up to 2 decimals');
  }
  const [naira, kobo = ''] = normalized.split('.');
  const amount = Number(naira) * 100 + Number(kobo.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Paid ticket price must be greater than ₦0');
  }
  return amount;
}

function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  return error instanceof Error ? error.message : toApiError(error, fallback).message;
}

const STEP_IDS: StepId[] = ['basic', 'date', 'format', 'location', 'admission', 'tickets', 'capacity', 'review'];
const STEP_LABELS: Record<StepId, string> = {
  basic: 'Basics',
  date: 'Date & time',
  format: 'Format',
  location: 'Location',
  admission: 'Admission',
  tickets: 'Tickets',
  capacity: 'Capacity',
  review: 'Review',
};

export default function CreateEventScreen() {
  const { eventId: routeEventId } = useLocalSearchParams<{ eventId?: string }>();
  const eventsQuery = useMyEvents();
  const existingEvent = eventsQuery.data?.find((event) => event.id === routeEventId);
  const ticketTypesQuery = useTicketTypes(routeEventId);

  if (routeEventId && eventsQuery.isLoading) {
    return <LoadingState label="Loading draft" style={styles.fullState} />;
  }
  if (routeEventId && (eventsQuery.isError || !existingEvent)) {
    return (
      <ErrorState
        title="Draft not found"
        message={eventsQuery.isError ? toApiError(eventsQuery.error).message : 'This event could not be found.'}
        onRetry={() => void eventsQuery.refetch()}
        retrying={eventsQuery.isRefetching}
        style={styles.fullState}
      />
    );
  }
  if (routeEventId && ticketTypesQuery.isLoading) {
    return <LoadingState label="Loading draft tickets" style={styles.fullState} />;
  }

  return (
    <EventWizard
      key={routeEventId ?? 'new'}
      initialEvent={existingEvent}
      initialTickets={ticketTypesQuery.data ?? []}
    />
  );
}

function EventWizard({
  initialEvent,
  initialTickets,
}: {
  initialEvent?: Event;
  initialTickets: NonNullable<ReturnType<typeof useTicketTypes>['data']>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<EventDraft>(() =>
    initialEvent ? eventToDraft(initialEvent) : makeInitialDraft(),
  );
  const [ticketRows, setTicketRows] = useState<TicketDraft[]>(() =>
    initialTickets.length > 0
      ? initialTickets.map((ticket) => ({
          id: ticket.id,
          localId: ticket.id,
          name: ticket.name,
          description: ticket.description ?? '',
          price: `${Math.floor(ticket.priceMinor / 100)}.${String(ticket.priceMinor % 100).padStart(2, '0')}`,
          quantity: String(ticket.quantityTotal),
        }))
      : [makeTicketDraft()],
  );
  const [draftId, setDraftId] = useState<string | undefined>(initialEvent?.id);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const ticketTypesQuery = useTicketTypes(draftId);

  const createEvent = useCreateEventMutation();
  const updateEvent = useUpdateEventMutation();
  const publishEvent = usePublishEventMutation();
  const createTicketType = useCreateTicketTypeMutation();
  const updateTicketType = useUpdateTicketTypeMutation();

  const steps = STEP_IDS.filter((step) => step !== 'tickets' || draft.admission === 'paid');
  const currentStep = steps[stepIndex] ?? 'review';

  const updateDraft = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setStepError(undefined);
  };

  const validateStep = (step: StepId): string | undefined => {
    if (step === 'basic') {
      const parsed = BASIC_INFO.safeParse(draft);
      return parsed.success ? undefined : parsed.error.issues[0]?.message;
    }

    if (step === 'date') {
      try {
        const startsAt = toIsoDateTime(draft.startsAt, draft.timezone, 'Start date and time');
        const endsAt = toIsoDateTime(draft.endsAt, draft.timezone, 'End date and time');
        if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
          return 'The end date and time must be after the start';
        }
      } catch (error) {
        return getErrorMessage(error);
      }
    }

    if (step === 'location') {
      if (draft.format === 'offline') {
        const parsed = Venue.safeParse({
          name: draft.venueName.trim(),
          address: draft.venueAddress.trim() || null,
          city: draft.venueCity.trim() || null,
          placeId: draft.placeId.trim() || null,
          lat: draft.latitude.trim() ? Number(draft.latitude) : null,
          lng: draft.longitude.trim() ? Number(draft.longitude) : null,
          instructions: draft.venueInstructions.trim() || null,
        });
        if (!parsed.success) return parsed.error.issues[0]?.message;
        if ((parsed.data.lat == null) !== (parsed.data.lng == null)) {
          return 'Enter both latitude and longitude, or leave both empty';
        }
      } else {
        const parsed = OnlineMeeting.safeParse({
          provider: 'external',
          url: draft.meetingUrl.trim(),
          instructions: draft.meetingInstructions.trim() || null,
        });
        if (!parsed.success) return parsed.error.issues[0]?.message;
        if (new URL(parsed.data.url).protocol !== 'https:') {
          return 'Use a secure HTTPS meeting link';
        }
      }
    }

    if (step === 'tickets' && draft.admission === 'paid') {
      if (ticketRows.length === 0) return 'Add at least one ticket type';
      for (const ticket of ticketRows) {
        try {
          const priceMinor = parseNairaToKobo(ticket.price);
          const quantityTotal = parseOptionalCount(ticket.quantity, 'Ticket quantity');
          const parsed = TicketTypeUpsertInput.safeParse({
            name: ticket.name.trim(),
            description: ticket.description.trim() || null,
            priceMinor,
            currency: 'NGN',
            quantityTotal,
            quantitySold: 0,
            minPerOrder: 1,
            maxPerOrder: Math.min(quantityTotal ?? 1, 10),
            isActive: true,
          });
          if (!parsed.success) return parsed.error.issues[0]?.message;
        } catch (error) {
          return getErrorMessage(error);
        }
      }
    }

    if (step === 'capacity') {
      try {
        parseOptionalCount(draft.capacity, 'Capacity');
        const opensAt = toIsoDateTime(
          draft.registrationOpensAt,
          draft.timezone,
          'Registration opening',
          true,
        );
        const closesAt = toIsoDateTime(
          draft.registrationClosesAt,
          draft.timezone,
          'Registration closing',
          true,
        );
        const startsAt = toIsoDateTime(draft.startsAt, draft.timezone, 'Start date and time');
        if (opensAt && closesAt && Date.parse(closesAt) <= Date.parse(opensAt)) {
          return 'Registration closing must be after registration opening';
        }
        if (opensAt && startsAt && Date.parse(opensAt) >= Date.parse(startsAt)) {
          return 'Registration must open before the event starts';
        }
        if (closesAt && startsAt && Date.parse(closesAt) > Date.parse(startsAt)) {
          return 'Registration must close before the event starts';
        }
        const capacity = parseOptionalCount(draft.capacity, 'Capacity');
        if (capacity !== null && draft.admission === 'paid') {
          const ticketCapacity = ticketRows.reduce(
            (total, ticket) => total + (parseOptionalCount(ticket.quantity, 'Ticket quantity') ?? 0),
            0,
          );
          if (ticketCapacity > capacity) {
            return 'Combined ticket quantities cannot exceed event capacity';
          }
        }
      } catch (error) {
        return getErrorMessage(error);
      }
    }

    return undefined;
  };

  const validateAll = (): string | undefined => {
    for (const step of steps) {
      if (step === 'review') continue;
      const error = validateStep(step);
      if (error) {
        setStepIndex(steps.indexOf(step));
        return error;
      }
    }
    return undefined;
  };

  const buildEventInput = () => {
    const parsedBasic = BASIC_INFO.parse(draft);
    const startsAt = toIsoDateTime(draft.startsAt, draft.timezone, 'Start date and time');
    const endsAt = toIsoDateTime(draft.endsAt, draft.timezone, 'End date and time');
    if (!startsAt || !endsAt) throw new Error('Enter both event start and end times');
    const registrationOpensAt = toIsoDateTime(
      draft.registrationOpensAt,
      draft.timezone,
      'Registration opening',
      true,
    );
    const registrationClosesAt = toIsoDateTime(
      draft.registrationClosesAt,
      draft.timezone,
      'Registration closing',
      true,
    );
    const venue =
      draft.format === 'offline'
        ? Venue.parse({
            name: draft.venueName.trim(),
            address: draft.venueAddress.trim() || null,
            city: draft.venueCity.trim() || null,
            placeId: draft.placeId.trim() || null,
            lat: draft.latitude.trim() ? Number(draft.latitude) : null,
            lng: draft.longitude.trim() ? Number(draft.longitude) : null,
            instructions: draft.venueInstructions.trim() || null,
          })
        : null;
    const onlineMeeting =
      draft.format === 'online'
        ? OnlineMeeting.parse({
            provider: 'external',
            url: draft.meetingUrl.trim(),
            instructions: draft.meetingInstructions.trim() || null,
          })
        : null;

    return EventUpsertInput.parse({
      title: parsedBasic.title.trim(),
      description: parsedBasic.description.trim(),
      coverImageUrl:
        parsedBasic.coverMediaType === 'image' ? parsedBasic.coverImageUrl || null : null,
      coverVideoUrl:
        parsedBasic.coverMediaType === 'video' ? parsedBasic.coverVideoUrl || null : null,
      startsAt,
      endsAt,
      timezone: draft.timezone.trim(),
      format: draft.format,
      admission: draft.admission,
      capacity: parseOptionalCount(draft.capacity, 'Capacity'),
      registrationOpensAt,
      registrationClosesAt,
      venue,
      onlineMeeting,
    });
  };

  const buildTicketInput = (ticket: TicketDraft): CreateTicketTypeInput => {
    const priceMinor = parseNairaToKobo(ticket.price);
    const quantityTotal = parseOptionalCount(ticket.quantity, 'Ticket quantity');
    if (quantityTotal === null) throw new Error('Ticket quantity is required');
    const salesStartsAt = toIsoDateTime(
      draft.registrationOpensAt,
      draft.timezone,
      'Registration opening',
      true,
    );
    const salesEndsAt = toIsoDateTime(
      draft.registrationClosesAt,
      draft.timezone,
      'Registration closing',
      true,
    );
    return {
      name: ticket.name.trim(),
      description: ticket.description.trim() || null,
      priceMinor,
      currency: 'NGN',
      quantityTotal,
      salesStartsAt,
      salesEndsAt,
      minPerOrder: 1,
      maxPerOrder: Math.min(quantityTotal, 10),
      isActive: true,
    };
  };

  const save = async (publish: boolean) => {
    const validationError = validateAll();
    if (validationError) {
      setStepError(validationError);
      return;
    }

    setSaving(true);
    setStepError(undefined);
    try {
      const input = buildEventInput();
      const event: Event = draftId
        ? await updateEvent.mutateAsync({ eventId: draftId, input })
        : await createEvent.mutateAsync(input);
      setDraftId(event.id);

      if (draft.admission === 'paid') {
        const savedIds = new Set<string>();
        for (const ticket of ticketRows) {
          const ticketInput = buildTicketInput(ticket);
          if (ticket.id) {
            await updateTicketType.mutateAsync({
              eventId: event.id,
              id: ticket.id,
              input: ticketInput,
            });
            savedIds.add(ticket.id);
          } else {
            const created = await createTicketType.mutateAsync({
              eventId: event.id,
              input: ticketInput,
            });
            savedIds.add(created.id);
            setTicketRows((current) =>
              current.map((row) =>
                row.localId === ticket.localId ? { ...row, id: created.id } : row,
              ),
            );
          }
        }
        for (const existing of ticketTypesQuery.data ?? []) {
          if (!savedIds.has(existing.id)) {
            await updateTicketType.mutateAsync({
              eventId: event.id,
              id: existing.id,
              input: { isActive: false },
            });
          }
        }
      } else {
        for (const existing of ticketTypesQuery.data ?? []) {
          await updateTicketType.mutateAsync({
            eventId: event.id,
            id: existing.id,
            input: { isActive: false },
          });
        }
      }

      if (publish) {
        const published = await publishEvent.mutateAsync(event.id);
        router.replace({ pathname: '/event/[slug]', params: { slug: published.slug } });
      } else {
        router.replace('/community');
      }
    } catch (error) {
      setStepError(getErrorMessage(error, 'Could not save this event. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    const error = validateStep(currentStep);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(undefined);
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.header}>
            <Button variant="secondary" onPress={() => router.back()} style={styles.backButton}>
              Back
            </Button>
            <ThemedText type="subtitle">{initialEvent ? 'Edit event draft' : 'Create an event'}</ThemedText>
            <StepDots current={stepIndex + 1} total={steps.length} label={STEP_LABELS[currentStep]} />
          </ThemedView>

          <ThemedView style={styles.stepContent}>
            {currentStep === 'basic' ? (
              <BasicStep
                draft={draft}
                updateDraft={updateDraft}
                setStepError={setStepError}
              />
            ) : null}
            {currentStep === 'date' ? <DateStep draft={draft} updateDraft={updateDraft} /> : null}
            {currentStep === 'format' ? <FormatStep draft={draft} updateDraft={updateDraft} /> : null}
            {currentStep === 'location' ? <LocationStep draft={draft} updateDraft={updateDraft} /> : null}
            {currentStep === 'admission' ? (
              <AdmissionStep draft={draft} updateDraft={updateDraft} />
            ) : null}
            {currentStep === 'tickets' ? (
              <TicketsStep
                ticketRows={ticketRows}
                setTicketRows={setTicketRows}
                setStepError={setStepError}
              />
            ) : null}
            {currentStep === 'capacity' ? (
              <CapacityStep draft={draft} updateDraft={updateDraft} />
            ) : null}
            {currentStep === 'review' ? (
              <ReviewStep draft={draft} ticketRows={ticketRows} existingEvent={initialEvent} />
            ) : null}
          </ThemedView>

          {stepError ? (
            <ThemedText themeColor="danger" accessibilityRole="alert">
              {stepError}
            </ThemedText>
          ) : null}

          <ThemedView style={styles.navigation}>
            <Button
              variant="secondary"
              compact={currentStep === 'review'}
              onPress={() => {
                setStepError(undefined);
                setStepIndex((index) => Math.max(0, index - 1));
              }}
              disabled={stepIndex === 0 || saving}
              style={currentStep === 'review' ? styles.reviewPrevious : styles.navButton}>
              Previous
            </Button>
            {currentStep === 'review' ? (
              <>
                <Button
                  variant="secondary"
                  compact
                  onPress={() => void save(false)}
                  loading={saving}
                  style={styles.reviewAction}>
                  Save draft
                </Button>
                <Button
                  compact
                  onPress={() => void save(true)}
                  loading={saving}
                  style={styles.reviewAction}>
                  Publish
                </Button>
              </>
            ) : (
              <Button onPress={handleNext} disabled={saving} style={styles.navButton}>
                Continue
              </Button>
            )}
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function eventToDraft(event: Event): EventDraft {
  return {
    title: event.title,
    description: event.description,
    coverImageUrl: event.coverImageUrl ?? '',
    coverVideoUrl: event.coverVideoUrl ?? '',
    coverMediaType: event.coverVideoUrl ? 'video' : event.coverImageUrl ? 'image' : null,
    startsAt: formatInTimeZone(new Date(event.startsAt), event.timezone, "yyyy-MM-dd'T'HH:mm"),
    endsAt: formatInTimeZone(new Date(event.endsAt), event.timezone, "yyyy-MM-dd'T'HH:mm"),
    timezone: event.timezone,
    format: event.format,
    venueName: event.venue?.name ?? '',
    venueAddress: event.venue?.address ?? '',
    venueCity: event.venue?.city ?? '',
    placeId: event.venue?.placeId ?? '',
    latitude: event.venue?.lat == null ? '' : String(event.venue.lat),
    longitude: event.venue?.lng == null ? '' : String(event.venue.lng),
    venueInstructions: event.venue?.instructions ?? '',
    meetingUrl: event.onlineMeeting?.url ?? '',
    meetingInstructions: event.onlineMeeting?.instructions ?? '',
    admission: event.admission,
    capacity: event.capacity == null ? '' : String(event.capacity),
    registrationOpensAt: event.registrationOpensAt
      ? formatInTimeZone(new Date(event.registrationOpensAt), event.timezone, "yyyy-MM-dd'T'HH:mm")
      : '',
    registrationClosesAt: event.registrationClosesAt
      ? formatInTimeZone(new Date(event.registrationClosesAt), event.timezone, "yyyy-MM-dd'T'HH:mm")
      : '',
  };
}

function BasicStep({
  draft,
  updateDraft,
  setStepError,
}: {
  draft: EventDraft;
  updateDraft: <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => void;
  setStepError: Dispatch<SetStateAction<string | undefined>>;
}) {
  const [pastingLink, setPastingLink] = useState(false);
  const [picking, setPicking] = useState(false);
  const [mediaError, setMediaError] = useState<string>();
  const theme = useTheme();

  const pickMedia = async () => {
    setMediaError(undefined);
    setPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMediaError('Allow photo library access to choose an event cover.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        videoMaxDuration: 30,
        quality: 0.85,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) {
        setMediaError('No media was selected. Please try again.');
        return;
      }
      if (asset.type !== 'image' && asset.type !== 'video') {
        setMediaError('Choose an image or video file.');
        return;
      }
      if (asset.type === 'video' && asset.duration != null && asset.duration > 30_000) {
        setMediaError('Choose a video that is 30 seconds or shorter.');
        return;
      }

      updateDraft('coverMediaType', asset.type);
      updateDraft(asset.type === 'video' ? 'coverVideoUrl' : 'coverImageUrl', asset.uri);
      updateDraft(asset.type === 'video' ? 'coverImageUrl' : 'coverVideoUrl', '');
      setPastingLink(false);
      setStepError(undefined);
    } catch (error) {
      setMediaError(getErrorMessage(error, 'Could not open your media library.'));
    } finally {
      setPicking(false);
    }
  };

  const mediaUrl = draft.coverMediaType === 'video' ? draft.coverVideoUrl : draft.coverImageUrl;
  const setMediaType = (type: 'image' | 'video') => {
    const currentUrl = draft.coverMediaType === 'video' ? draft.coverVideoUrl : draft.coverImageUrl;
    updateDraft('coverMediaType', type);
    updateDraft('coverImageUrl', type === 'image' ? currentUrl : '');
    updateDraft('coverVideoUrl', type === 'video' ? currentUrl : '');
    setMediaError(undefined);
  };

  return (
    <ThemedView style={styles.section}>
      <StepHeading title="Add a cover" body="Start with an image or a short video for your event." />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mediaUrl ? 'Change event cover media' : 'Choose event cover image or video'}
        onPress={() => void pickMedia()}
        style={({ pressed }) => [
          styles.mediaBox,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
          pressed && styles.mediaPressed,
        ]}>
        {draft.coverMediaType === 'video' && mediaUrl ? (
          <CoverVideoPreview uri={mediaUrl} />
        ) : draft.coverMediaType === 'image' && mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={styles.mediaPreview} contentFit="cover" />
        ) : (
          <ThemedView style={styles.mediaPlaceholder}>
            <ThemedText style={styles.mediaPlus}>+</ThemedText>
            <ThemedText type="smallBold">Upload an image or short video</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Rectangular cover · videos up to 30 seconds
            </ThemedText>
          </ThemedView>
        )}
      </Pressable>
      <ThemedView style={styles.mediaActions}>
        <ThemedView style={styles.halfField}>
          <Button variant="secondary" onPress={() => void pickMedia()} loading={picking}>
            Upload
          </Button>
        </ThemedView>
        <ThemedView style={styles.halfField}>
          <Button
            variant="secondary"
            onPress={() => {
              const willOpenLink = !pastingLink;
              if (willOpenLink && mediaUrl.startsWith('file:')) {
                updateDraft(draft.coverMediaType === 'video' ? 'coverVideoUrl' : 'coverImageUrl', '');
              }
              setPastingLink(willOpenLink);
              setMediaError(undefined);
            }}>
            {pastingLink ? 'Close link' : 'Paste a link'}
          </Button>
        </ThemedView>
      </ThemedView>
      {pastingLink ? (
        <ThemedView style={styles.section}>
          <ThemedText type="small" themeColor="textSecondary">
            Use a public HTTPS image or video URL.
          </ThemedText>
          <ThemedView style={styles.choiceRow}>
            <Chip
              label="Image"
              selected={draft.coverMediaType !== 'video'}
              onPress={() => setMediaType('image')}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.coverMediaType !== 'video' }}
            />
            <Chip
              label="Video"
              selected={draft.coverMediaType === 'video'}
              onPress={() => setMediaType('video')}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.coverMediaType === 'video' }}
            />
          </ThemedView>
          <Field label={draft.coverMediaType === 'video' ? 'Video link' : 'Image link'}>
            <Input
              value={mediaUrl}
              onChangeText={(value) => {
                updateDraft(
                  draft.coverMediaType === 'video' ? 'coverVideoUrl' : 'coverImageUrl',
                  value,
                );
                setMediaError(undefined);
              }}
              placeholder={
                draft.coverMediaType === 'video'
                  ? 'https://example.com/event-video.mp4'
                  : 'https://example.com/event-cover.jpg'
              }
              autoCapitalize="none"
              keyboardType="url"
              accessibilityLabel={draft.coverMediaType === 'video' ? 'Video link' : 'Image link'}
            />
          </Field>
        </ThemedView>
      ) : null}
      {draft.coverMediaType && mediaUrl ? (
        <Button
          variant="secondary"
          onPress={() => {
            updateDraft('coverMediaType', null);
            updateDraft('coverImageUrl', '');
            updateDraft('coverVideoUrl', '');
            setMediaError(undefined);
          }}>
          Remove cover
        </Button>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        Picked files preview locally in mock mode; shared media upload storage is not connected yet.
      </ThemedText>
      {mediaError ? (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {mediaError}
        </ThemedText>
      ) : null}
      <StepHeading title="Event details" body="Give your event a clear name and description." />
      <Field label="Event title">
        <Input
          value={draft.title}
          onChangeText={(value) => updateDraft('title', value)}
          placeholder="e.g. Lagos Design Meetup"
          maxLength={200}
          accessibilityLabel="Event title"
        />
      </Field>
      <Field label="Description" hint="Tell people what to expect.">
        <Input
          value={draft.description}
          onChangeText={(value) => updateDraft('description', value)}
          placeholder="Describe your event"
          multiline
          maxLength={10_000}
          accessibilityLabel="Event description"
        />
      </Field>
    </ThemedView>
  );
}

function CoverVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.mediaPreview}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function DateStep({
  draft,
  updateDraft,
}: {
  draft: EventDraft;
  updateDraft: <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => void;
}) {
  const theme = useTheme();
  const [timezonePickerVisible, setTimezonePickerVisible] = useState(false);

  return (
    <ThemedView style={styles.section}>
      <StepHeading title="When is it?" body="Choose the event dates and times in the event's timezone." />
      <DateTimeField
        label="Starts at"
        value={draft.startsAt}
        timezone={draft.timezone}
        onChange={(value) => updateDraft('startsAt', value)}
      />
      <DateTimeField
        label="Ends at"
        value={draft.endsAt}
        timezone={draft.timezone}
        onChange={(value) => updateDraft('endsAt', value)}
      />
      <Field label="Timezone">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Event timezone: ${timezoneLabel(draft.timezone)}`}
          onPress={() => setTimezonePickerVisible(true)}
          style={({ pressed }) => [
            styles.pickerTrigger,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pickerTriggerPressed,
          ]}>
          <ThemedText>{timezoneLabel(draft.timezone)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">⌄</ThemedText>
        </Pressable>
      </Field>
      <TimezonePickerModal
        visible={timezonePickerVisible}
        selectedTimezone={draft.timezone}
        onSelect={(timezone) => {
          updateDraft('timezone', timezone);
          setTimezonePickerVisible(false);
        }}
        onClose={() => setTimezonePickerVisible(false)}
      />
    </ThemedView>
  );
}

const TIMEZONE_OPTIONS = [
  'Africa/Abidjan', 'Africa/Accra', 'Africa/Cairo', 'Africa/Casablanca',
  'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Tunis',
  'America/Anchorage', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Mexico_City', 'America/New_York', 'America/Sao_Paulo',
  'Asia/Bangkok', 'Asia/Dubai', 'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Kolkata',
  'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Melbourne', 'Australia/Sydney', 'Europe/Amsterdam', 'Europe/Berlin',
  'Europe/Istanbul', 'Europe/London', 'Europe/Paris', 'Pacific/Auckland', 'UTC',
] as const;

function timezoneLabel(timezone: string): string {
  return timezone.replace(/_/g, ' ').replace('/', ' / ');
}

function DateTimeField({
  label,
  value,
  timezone,
  onChange,
}: {
  label: string;
  value: string;
  timezone: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [timeVisible, setTimeVisible] = useState(false);
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart?.split('-').map(Number) ?? [];
  const [hour, minute] = timePart?.split(':').map(Number) ?? [];
  const dateLabel = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(year, month - 1, day))
    : 'Select date';
  const timeLabel = Number.isFinite(hour) && Number.isFinite(minute)
    ? new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC',
      }).format(new Date(Date.UTC(2020, 0, 1, hour, minute)))
    : 'Select time';

  return (
    <ThemedView style={styles.dateTimeField}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedView style={styles.dateTimeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} date: ${dateLabel}`}
          accessibilityHint="Opens calendar"
          onPress={() => setCalendarVisible(true)}
          style={({ pressed }) => [
            styles.pickerTrigger,
            styles.dateTrigger,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pickerTriggerPressed,
          ]}>
          <ThemedText type="small" themeColor="textSecondary">Date</ThemedText>
          <ThemedText type="smallBold">{dateLabel}</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} time: ${timeLabel}`}
          accessibilityHint="Opens time selector"
          onPress={() => setTimeVisible(true)}
          style={({ pressed }) => [
            styles.pickerTrigger,
            styles.timeTrigger,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pickerTriggerPressed,
          ]}>
          <ThemedText type="small" themeColor="textSecondary">Time</ThemedText>
          <ThemedText type="smallBold">{timeLabel}</ThemedText>
        </Pressable>
      </ThemedView>
      <ThemedText type="small" themeColor="textSecondary">{timezone}</ThemedText>
      {calendarVisible ? (
        <CalendarPickerModal
          value={value}
          onClose={() => setCalendarVisible(false)}
          onSelect={(nextValue) => {
            onChange(nextValue);
            setCalendarVisible(false);
          }}
        />
      ) : null}
      {timeVisible ? (
        <TimePickerModal
          value={value}
          onClose={() => setTimeVisible(false)}
          onSelect={(nextValue) => {
            onChange(nextValue);
            setTimeVisible(false);
          }}
        />
      ) : null}
    </ThemedView>
  );
}

function CalendarPickerModal({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart?.split('-').map(Number) ?? [];
  const [hour, minute] = timePart?.split(':').map(Number) ?? [];
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(year, month - 1, 1));
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const leadingDays = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(visibleMonth);

  const chooseDay = (selectedDay: number) => {
    const date = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    onSelect(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ThemedView style={[styles.modalCard, { backgroundColor: theme.background }]}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText type="smallBold">Select a date</ThemedText>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <ThemedText type="smallBold">Close</ThemedText>
            </Pressable>
          </ThemedView>
          <ThemedView style={styles.calendarHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              style={styles.calendarArrow}>
              <ThemedText type="subtitle" style={styles.arrowText}>‹</ThemedText>
            </Pressable>
            <ThemedText type="smallBold">{monthLabel}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              style={styles.calendarArrow}>
              <ThemedText type="subtitle" style={styles.arrowText}>›</ThemedText>
            </Pressable>
          </ThemedView>
          <View style={styles.weekRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
              <ThemedText key={weekday} type="small" themeColor="textSecondary" style={styles.weekday}>{weekday}</ThemedText>
            ))}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={styles.weekRow}>
              {cells.slice(row * 7, row * 7 + 7).map((cell, column) => {
                const selected = cell === day && year === visibleMonth.getFullYear() && month === visibleMonth.getMonth() + 1;
                return (
                  <View key={`${row}-${column}`} style={styles.dayCell}>
                    {cell ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${monthLabel} ${cell}`}
                        accessibilityState={{ selected }}
                        onPress={() => chooseDay(cell)}
                        style={[styles.dayButton, selected && { backgroundColor: theme.text }]}>
                        <ThemedText type="small" style={[styles.dayNumber, selected && { color: theme.background }]}>
                          {cell}
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
          <Button variant="secondary" compact onPress={onClose}>Cancel</Button>
        </ThemedView>
      </View>
    </Modal>
  );
}

function TimePickerModal({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart?.split('-').map(Number) ?? [];
  const [initialHour, initialMinute] = timePart?.split(':').map(Number) ?? [];
  const [selectedHour, setSelectedHour] = useState(initialHour % 12 || 12);
  const [selectedMinute, setSelectedMinute] = useState(Math.round(initialMinute / 5) * 5 % 60);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initialHour >= 12 ? 'PM' : 'AM');
  const adjustHour = (amount: number) => setSelectedHour((current) => ((current - 1 + amount + 12) % 12) + 1);
  const adjustMinute = (amount: number) => setSelectedMinute((current) => (current + amount + 60) % 60);

  const confirm = () => {
    const hour24 = (selectedHour % 12) + (period === 'PM' ? 12 : 0);
    onSelect(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour24).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ThemedView style={[styles.modalCard, { backgroundColor: theme.background }]}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText type="smallBold">Select a time</ThemedText>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <ThemedText type="smallBold">Close</ThemedText>
            </Pressable>
          </ThemedView>
          <ThemedText style={styles.timeModalValue}>
            {selectedHour}:{String(selectedMinute).padStart(2, '0')} {period}
          </ThemedText>
          <ThemedView style={styles.timeModalControls}>
            <TimePart label="Hour" value={selectedHour} onDecrease={() => adjustHour(-1)} onIncrease={() => adjustHour(1)} />
            <ThemedText type="subtitle" style={styles.timeColon}>:</ThemedText>
            <TimePart label="Minute" value={selectedMinute} onDecrease={() => adjustMinute(-5)} onIncrease={() => adjustMinute(5)} />
          </ThemedView>
          <ThemedView style={styles.periodRow}>
            {(['AM', 'PM'] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: period === option }}
                onPress={() => setPeriod(option)}
                style={[styles.periodButton, { backgroundColor: period === option ? theme.text : theme.backgroundElement }]}>
                <ThemedText type="smallBold" style={{ color: period === option ? theme.background : theme.text }}>{option}</ThemedText>
              </Pressable>
            ))}
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary" style={styles.timeModalHint}>Minutes change in 5-minute steps</ThemedText>
          <ThemedView style={styles.modalActions}>
            <Button variant="secondary" compact onPress={onClose} style={styles.modalAction}>Cancel</Button>
            <Button compact onPress={confirm} style={styles.modalAction}>Done</Button>
          </ThemedView>
        </ThemedView>
      </View>
    </Modal>
  );
}

function TimezonePickerModal({
  visible,
  selectedTimezone,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedTimezone: string;
  onSelect: (timezone: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ThemedView style={[styles.modalCard, styles.timezoneModalCard, { backgroundColor: theme.background }]}>
          <ThemedView style={styles.modalHeader}>
            <ThemedText type="smallBold">Select timezone</ThemedText>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <ThemedText type="smallBold">Close</ThemedText>
            </Pressable>
          </ThemedView>
          <ScrollView style={styles.timezoneList} showsVerticalScrollIndicator={false}>
            {TIMEZONE_OPTIONS.map((timezone) => {
              const selected = timezone === selectedTimezone;
              return (
                <Pressable
                  key={timezone}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(timezone)}
                  style={[styles.timezoneOption, selected && { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type={selected ? 'smallBold' : 'small'}>{timezoneLabel(timezone)}</ThemedText>
                  {selected ? <ThemedText type="smallBold">✓</ThemedText> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

function TimePart({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.timePart}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedView style={styles.timeControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label.toLowerCase()}`}
          onPress={onDecrease}
          style={[styles.timeAdjust, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">−</ThemedText>
        </Pressable>
        <ThemedText style={styles.timeValue}>
          {String(Number.isFinite(value) ? value : 0).padStart(2, '0')}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label.toLowerCase()}`}
          onPress={onIncrease}
          style={[styles.timeAdjust, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">+</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

function FormatStep({
  draft,
  updateDraft,
}: {
  draft: EventDraft;
  updateDraft: <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => void;
}) {
  return (
    <ThemedView style={styles.section}>
      <StepHeading title="Choose the event format" body="Online or in person. Admission is configured separately." />
      <ThemedView style={styles.choiceRow}>
        <Chip
          label="In person"
          selected={draft.format === 'offline'}
          onPress={() => updateDraft('format', 'offline')}
          accessibilityRole="radio"
          accessibilityState={{ selected: draft.format === 'offline' }}
        />
        <Chip
          label="Online"
          selected={draft.format === 'online'}
          onPress={() => updateDraft('format', 'online')}
          accessibilityRole="radio"
          accessibilityState={{ selected: draft.format === 'online' }}
        />
      </ThemedView>
    </ThemedView>
  );
}

function LocationStep({
  draft,
  updateDraft,
}: {
  draft: EventDraft;
  updateDraft: <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => void;
}) {
  if (draft.format === 'offline') {
    return (
      <ThemedView style={styles.section}>
        <StepHeading title="Where will it happen?" body="Venue details are visible on the public event page." />
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Places autocomplete is not connected yet. Enter venue details manually; place ID and coordinates are optional.
          </ThemedText>
        </Card>
        <Field label="Venue name">
          <Input
            value={draft.venueName}
            onChangeText={(value) => updateDraft('venueName', value)}
            placeholder="Venue name"
            accessibilityLabel="Venue name"
          />
        </Field>
        <Field label="Address">
          <Input
            value={draft.venueAddress}
            onChangeText={(value) => updateDraft('venueAddress', value)}
            placeholder="Street address"
            accessibilityLabel="Venue address"
          />
        </Field>
        <Field label="City">
          <Input
            value={draft.venueCity}
            onChangeText={(value) => updateDraft('venueCity', value)}
            placeholder="Lagos"
            accessibilityLabel="Venue city"
          />
        </Field>
        <Field label="Place ID (optional)">
          <Input
            value={draft.placeId}
            onChangeText={(value) => updateDraft('placeId', value)}
            placeholder="Google Place ID"
            autoCapitalize="none"
            accessibilityLabel="Venue place ID"
          />
        </Field>
        <ThemedView style={styles.choiceRow}>
          <ThemedView style={styles.halfField}>
            <Field label="Latitude (optional)">
              <Input
                value={draft.latitude}
                onChangeText={(value) => updateDraft('latitude', value)}
                placeholder="6.5244"
                keyboardType="decimal-pad"
                accessibilityLabel="Venue latitude"
              />
            </Field>
          </ThemedView>
          <ThemedView style={styles.halfField}>
            <Field label="Longitude (optional)">
              <Input
                value={draft.longitude}
                onChangeText={(value) => updateDraft('longitude', value)}
                placeholder="3.3792"
                keyboardType="decimal-pad"
                accessibilityLabel="Venue longitude"
              />
            </Field>
          </ThemedView>
        </ThemedView>
        <Field label="Location instructions (optional)">
          <Input
            value={draft.venueInstructions}
            onChangeText={(value) => updateDraft('venueInstructions', value)}
            placeholder="Arrival or access instructions"
            multiline
            accessibilityLabel="Location instructions"
          />
        </Field>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.section}>
      <StepHeading title="Add the meeting link" body="This link stays private and is not included in public event details." />
      <Field label="Meeting URL" hint="Use the external meeting link attendees should join.">
        <Input
          value={draft.meetingUrl}
          onChangeText={(value) => updateDraft('meetingUrl', value)}
          placeholder="https://meet.example.com/your-event"
          autoCapitalize="none"
          keyboardType="url"
          accessibilityLabel="Meeting URL"
        />
      </Field>
      <Field label="Joining instructions (optional)">
        <Input
          value={draft.meetingInstructions}
          onChangeText={(value) => updateDraft('meetingInstructions', value)}
          placeholder="How attendees can join"
          multiline
          accessibilityLabel="Meeting instructions"
        />
      </Field>
    </ThemedView>
  );
}

function AdmissionStep({
  draft,
  updateDraft,
}: {
  draft: EventDraft;
  updateDraft: <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => void;
}) {
  return (
    <ThemedView style={styles.section}>
      <StepHeading title="Set admission" body="Choose free registration or configure paid ticket types next." />
      <ThemedView style={styles.choiceRow}>
        <Chip
          label="Free"
          selected={draft.admission === 'free'}
          onPress={() => updateDraft('admission', 'free')}
          accessibilityRole="radio"
          accessibilityState={{ selected: draft.admission === 'free' }}
        />
        <Chip
          label="Paid"
          selected={draft.admission === 'paid'}
          onPress={() => updateDraft('admission', 'paid')}
          accessibilityRole="radio"
          accessibilityState={{ selected: draft.admission === 'paid' }}
        />
      </ThemedView>
    </ThemedView>
  );
}

function TicketsStep({
  ticketRows,
  setTicketRows,
  setStepError,
}: {
  ticketRows: TicketDraft[];
  setTicketRows: Dispatch<SetStateAction<TicketDraft[]>>;
  setStepError: Dispatch<SetStateAction<string | undefined>>;
}) {
  const patchTicket = (localId: string, key: keyof TicketDraft, value: string) => {
    setTicketRows((current) =>
      current.map((ticket) => (ticket.localId === localId ? { ...ticket, [key]: value } : ticket)),
    );
    setStepError(undefined);
  };

  return (
    <ThemedView style={styles.section}>
      <StepHeading title="Create ticket types" body="Prices are entered in NGN and stored as integer kobo." />
      {ticketRows.map((ticket, index) => (
        <Card key={ticket.localId} style={styles.ticketCard}>
          <ThemedView style={styles.ticketHeader}>
            <ThemedText type="smallBold">Ticket {index + 1}</ThemedText>
            {ticketRows.length > 1 ? (
              <Button
                variant="secondary"
                onPress={() => setTicketRows((current) => current.filter((row) => row.localId !== ticket.localId))}
                style={styles.removeButton}>
                Remove
              </Button>
            ) : null}
          </ThemedView>
          <Field label="Ticket name">
            <Input
              value={ticket.name}
              onChangeText={(value) => patchTicket(ticket.localId, 'name', value)}
              placeholder="Early bird"
              maxLength={120}
              accessibilityLabel={`Ticket ${index + 1} name`}
            />
          </Field>
          <Field label="Description (optional)">
            <Input
              value={ticket.description}
              onChangeText={(value) => patchTicket(ticket.localId, 'description', value)}
              placeholder="What this ticket includes"
              maxLength={500}
              accessibilityLabel={`Ticket ${index + 1} description`}
            />
          </Field>
          <ThemedView style={styles.choiceRow}>
            <ThemedView style={styles.halfField}>
              <Field label="Price (NGN)">
                <Input
                  value={ticket.price}
                  onChangeText={(value) => patchTicket(ticket.localId, 'price', value)}
                  placeholder="5000"
                  keyboardType="decimal-pad"
                  accessibilityLabel={`Ticket ${index + 1} price in naira`}
                />
              </Field>
            </ThemedView>
            <ThemedView style={styles.halfField}>
              <Field label="Quantity">
                <Input
                  value={ticket.quantity}
                  onChangeText={(value) => patchTicket(ticket.localId, 'quantity', value)}
                  placeholder="50"
                  keyboardType="number-pad"
                  accessibilityLabel={`Ticket ${index + 1} quantity`}
                />
              </Field>
            </ThemedView>
          </ThemedView>
        </Card>
      ))}
      <Button
        variant="secondary"
        onPress={() => {
          const newTicket = makeTicketDraft();
          setTicketRows((current) => [...current, newTicket]);
          setStepError(undefined);
        }}>
        Add ticket type
      </Button>
      <ThemedText type="small" themeColor="textSecondary">
        Ticket sales follow the event registration window. Provider fees and platform commission are calculated by the backend, not here.
      </ThemedText>
    </ThemedView>
  );
}

function CapacityStep({
  draft,
  updateDraft,
}: {
  draft: EventDraft;
  updateDraft: <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => void;
}) {
  return (
    <ThemedView style={styles.section}>
      <StepHeading title="Capacity and registration" body="These limits are still enforced by the backend when it is connected." />
      <Field label="Maximum attendees (optional)">
        <Input
          value={draft.capacity}
          onChangeText={(value) => updateDraft('capacity', value)}
          placeholder="Leave blank for no event-wide limit"
          keyboardType="number-pad"
          accessibilityLabel="Maximum attendees"
        />
      </Field>
      <Field label="Registration opens (optional)" hint="Format: YYYY-MM-DDTHH:mm in the event timezone.">
        <Input
          value={draft.registrationOpensAt}
          onChangeText={(value) => updateDraft('registrationOpensAt', value)}
          placeholder="2026-11-20T09:00"
          autoCapitalize="none"
          accessibilityLabel="Registration opening date and time"
        />
      </Field>
      <Field label="Registration closes (optional)">
        <Input
          value={draft.registrationClosesAt}
          onChangeText={(value) => updateDraft('registrationClosesAt', value)}
          placeholder="2026-12-01T17:00"
          autoCapitalize="none"
          accessibilityLabel="Registration closing date and time"
        />
      </Field>
    </ThemedView>
  );
}

function ReviewStep({
  draft,
  ticketRows,
  existingEvent,
}: {
  draft: EventDraft;
  ticketRows: TicketDraft[];
  existingEvent?: Event;
}) {
  return (
    <ThemedView style={styles.section}>
      <StepHeading
        title="Review your event"
        body="Save a private draft to continue later, or publish it to make it publicly discoverable."
      />
      <Card style={styles.reviewCard}>
        <ReviewRow label="Event" value={draft.title || 'Untitled event'} />
        <ReviewRow label="Format" value={draft.format === 'online' ? 'Online' : 'In person'} />
        <ReviewRow label="Admission" value={draft.admission === 'paid' ? 'Paid' : 'Free'} />
        <ReviewRow label="Timezone" value={draft.timezone} />
        {draft.format === 'offline' ? (
          <ReviewRow label="Venue" value={[draft.venueName, draft.venueCity].filter(Boolean).join(' · ') || 'Not set'} />
        ) : (
          <ReviewRow label="Meeting link" value="Private attendee details" />
        )}
        {draft.admission === 'paid' ? (
          <ReviewRow label="Ticket types" value={String(ticketRows.length)} />
        ) : null}
        {draft.capacity ? <ReviewRow label="Capacity" value={draft.capacity} /> : null}
        {existingEvent ? <ReviewRow label="Status" value={existingEvent.status} /> : null}
      </Card>
      <ThemedText type="small" themeColor="textSecondary">
        Publishing makes this event visible to attendees. Online access links are kept out of public event responses.
      </ThemedText>
    </ThemedView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.reviewRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.reviewValue}>{value}</ThemedText>
    </ThemedView>
  );
}

function StepHeading({ title, body }: { title: string; body: string }) {
  return (
    <ThemedView style={styles.heading}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {body}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  fullState: {
    flex: 1,
  },
  header: {
    gap: Spacing.three,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  stepContent: {
    flex: 1,
  },
  section: {
    gap: Spacing.three,
  },
  mediaBox: {
    width: '100%',
    height: 190,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.three,
  },
  mediaPlus: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: 300,
  },
  mediaPressed: {
    opacity: 0.8,
  },
  mediaActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  heading: {
    gap: Spacing.one,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 12,
  },
  dateTimeField: {
    gap: Spacing.two,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pickerTrigger: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },
  pickerTriggerPressed: {
    opacity: 0.72,
  },
  dateTrigger: {
    flex: 1.4,
    alignItems: 'flex-start',
  },
  timeTrigger: {
    flex: 1,
    alignItems: 'flex-start',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarArrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    lineHeight: 36,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.half,
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 13,
    lineHeight: 18,
  },
  timezoneModalCard: {
    maxHeight: '80%',
  },
  timezoneList: {
    flexGrow: 0,
  },
  timezoneOption: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: 10,
  },
  timeModalValue: {
    textAlign: 'center',
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  timeModalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.two,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  periodButton: {
    minWidth: 76,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  timeModalHint: {
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modalAction: {
    flex: 1,
  },
  timePart: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  timeAdjust: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  timeValue: {
    minWidth: 42,
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  timeColon: {
    marginTop: Spacing.three,
  },
  halfField: {
    flex: 1,
  },
  ticketCard: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  removeButton: {
    minHeight: 36,
    alignSelf: 'auto',
  },
  reviewCard: {
    gap: Spacing.three,
  },
  reviewRow: {
    gap: Spacing.half,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  reviewValue: {
    fontWeight: 600,
  },
  navigation: {
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
  },
  navButton: {
    
  },
  reviewPrevious: {
    flexGrow: 0,
    flexBasis: 86,
  },
  reviewAction: {
    flex: 1,
  },
});
