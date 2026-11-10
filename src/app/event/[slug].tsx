import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Share, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventCover } from '@/components/event-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Money } from '@/components/ui/money';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useEvent } from '@/api/queries/events';
import { useTicketTypes } from '@/api/queries/tickets';
import { formatEventDates } from '@/lib/datetime';
import { toApiError } from '@shared/errors';
import type { PublicEvent } from '@shared/contracts';

export default function EventDetailScreen() {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const eventQuery = useEvent(slug);
  const event = eventQuery.data;
  const ticketTypesQuery = useTicketTypes(event?.id);

  if (!slug || eventQuery.isError || (!eventQuery.isLoading && !event)) {
    return (
      <ErrorState
        title="Event not available"
        message={toApiError(eventQuery.error).message}
        onRetry={() => void eventQuery.refetch()}
        retrying={eventQuery.isRefetching}
        style={styles.state}
      />
    );
  }

  if (eventQuery.isLoading || !event) {
    return <LoadingState label="Loading event" style={styles.state} />;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <EventCover title={event.title} imageUrl={event.coverImageUrl ?? null} />
        <ThemedView style={styles.content}>
          <Button variant="secondary" onPress={() => router.back()} style={styles.backButton}>
            Back
          </Button>
          <ThemedText type="subtitle">{event.title}</ThemedText>
          <ThemedView style={styles.chipRow}>
            <Chip label={event.format === 'online' ? 'Online' : 'In person'} />
            <Chip label={event.admission === 'free' ? 'Free' : 'Paid'} />
          </ThemedView>
          <DateAndLocation event={event} />
          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">About this event</ThemedText>
            <ThemedText>{event.description}</ThemedText>
          </ThemedView>
          <TicketSection paid={event.admission === 'paid'} ticketTypesQuery={ticketTypesQuery} />
        </ThemedView>
      </ScrollView>
      <ThemedView style={[styles.ctaRow, { paddingBottom: inset.bottom + Spacing.two }]}>
        <Button onPress={() => router.push({ pathname: '/register/[slug]', params: { slug } })}>
          Register
        </Button>
        <Button
          variant="secondary"
          onPress={() =>
            void Share.share({
              message: `${event.title} — in app: lumaclone://event/${event.slug} · web: https://lumaclone.app/event/${event.slug}`,
            })
          }>
          Share
        </Button>
      </ThemedView>
    </ThemedView>
  );
}

function DateAndLocation({ event }: { event: PublicEvent }) {
  const dates = formatEventDates(event.startsAt, event.endsAt, event.timezone);
  return (
    <Card>
      <ThemedText type="smallBold">{dates.dateLabel}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {dates.timeLabel}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Time zone: {dates.timezoneLabel}
      </ThemedText>
      {event.format === 'offline' && event.venue ? (
        <VenueBlock
          name={event.venue.name}
          address={event.venue.address ?? null}
          instructions={event.venue.instructions ?? null}
          lat={event.venue.lat}
          lng={event.venue.lng}
        />
      ) : event.format === 'online' ? (
        <OnlineNotice />
      ) : null}
    </Card>
  );
}

function VenueBlock({
  name,
  address,
  instructions,
  lat,
  lng,
}: {
  name: string;
  address: string | null;
  instructions: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const destination =
    typeof lat === 'number' && typeof lng === 'number'
      ? `${lat},${lng}`
      : encodeURIComponent(name);
  return (
    <ThemedView type="background" style={styles.venueBlock}>
      <ThemedText type="smallBold">{name}</ThemedText>
      {address ? (
        <ThemedText type="small" themeColor="textSecondary">
          {address}
        </ThemedText>
      ) : null}
      {instructions ? (
        <ThemedText type="small" themeColor="textSecondary">
          {instructions}
        </ThemedText>
      ) : null}
      <Button
        variant="secondary"
        onPress={() =>
          void Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
          )
        }>
        Open in Maps
      </Button>
    </ThemedView>
  );
}

function OnlineNotice() {
  return (
    <ThemedView type="background" style={styles.venueBlock}>
      <ThemedText type="smallBold">Online event</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Joining details are shared with registered attendees only.
      </ThemedText>
    </ThemedView>
  );
}

function TicketSection({
  paid,
  ticketTypesQuery,
}: {
  paid: boolean;
  ticketTypesQuery: ReturnType<typeof useTicketTypes>;
}) {
  if (ticketTypesQuery.isLoading) {
    return <LoadingState label="Loading tickets" />;
  }
  const ticketTypes = ticketTypesQuery.data ?? [];
  if (ticketTypes.length === 0) {
    return (
      <EmptyState
        title="No tickets available"
        body={paid ? 'The organiser has not opened sales yet.' : 'Registration is not open yet.'}
      />
    );
  }
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="smallBold">Tickets</ThemedText>
      {ticketTypes.map((ticketType) => {
        const remaining = Math.max(0, ticketType.quantityTotal - ticketType.quantitySold);
        return (
          <Card key={ticketType.id}>
            <ThemedView type="backgroundElement" style={styles.ticketRow}>
              <ThemedView type="backgroundElement" style={styles.ticketInfo}>
                <ThemedText>{ticketType.name}</ThemedText>
                {ticketType.description ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {ticketType.description}
                  </ThemedText>
                ) : null}
                <ThemedText type="small" themeColor="textSecondary">
                  {remaining > 0 ? `${remaining} left` : 'Sold out'}
                </ThemedText>
              </ThemedView>
              <Money minor={ticketType.priceMinor} />
            </ThemedView>
          </Card>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  venueBlock: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  ticketInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  state: {
    flex: 1,
  },
});
