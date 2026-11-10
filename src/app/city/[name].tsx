import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventCard } from '@/components/event-card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useEvents } from '@/api/queries/events';
import { toApiError } from '@shared/errors';

export default function CityEventsScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const eventsQuery = useEvents({ city: name });
  const events = eventsQuery.data ?? [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={events}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <ThemedView style={styles.header}>
            <Button variant="secondary" onPress={() => router.back()} style={styles.backButton}>
              Back
            </Button>
            <ThemedText type="title">{name} events</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {eventsQuery.isLoading ? 'Loading events…' : `${events.length} upcoming` }
            </ThemedText>
          </ThemedView>
        }
        renderItem={({ item }) => (
          <EventCard
            event={item}
            onPress={() => router.push({ pathname: '/event/[slug]', params: { slug: item.slug } })}
          />
        )}
        ListEmptyComponent={(() => {
          if (eventsQuery.isLoading) {
            return <LoadingState label="Loading events" />;
          }
          if (eventsQuery.isError) {
            return (
              <ErrorState
                title="Could not load events"
                message={toApiError(eventsQuery.error).message}
                onRetry={() => void eventsQuery.refetch()}
                retrying={eventsQuery.isRefetching}
              />
            );
          }
          return (
            <EmptyState
              title="Nothing here yet"
              body={`There are no upcoming events in ${name} right now. Check back soon.`}
            />
          );
        })()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
});
