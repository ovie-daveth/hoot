import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMyEvents } from '@/api/queries/events';
import { CreateEventFab } from '@/components/create-event-fab';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { toApiError } from '@shared/errors';

export default function CommunityScreen() {
  const router = useRouter();
  const eventsQuery = useMyEvents();
  const drafts = (eventsQuery.data ?? []).filter((event) => event.status === 'draft');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={drafts}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle">Community</ThemedText>
            <ThemedText themeColor="textSecondary">
              Bring people together around the things you care about.
            </ThemedText>
            <ThemedText type="smallBold">Your event drafts</ThemedText>
          </ThemedView>
        }
        renderItem={({ item }) => (
          <Card style={styles.draftCard}>
            <ThemedView style={styles.draftDetails}>
              <ThemedText type="smallBold">{item.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Draft · {item.format === 'online' ? 'Online' : 'In person'} ·{' '}
                {item.admission === 'paid' ? 'Paid' : 'Free'}
              </ThemedText>
            </ThemedView>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Continue editing ${item.title}`}
              onPress={() =>
                router.push({ pathname: '/create-event', params: { eventId: item.id } })
              }
              style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold">Continue editing</ThemedText>
            </Pressable>
          </Card>
        )}
        ListEmptyComponent={(() => {
          if (eventsQuery.isLoading) return <LoadingState label="Loading your drafts" />;
          if (eventsQuery.isError) {
            return (
              <ErrorState
                title="Could not load drafts"
                message={toApiError(eventsQuery.error).message}
                onRetry={() => void eventsQuery.refetch()}
                retrying={eventsQuery.isRefetching}
              />
            );
          }
          return (
            <EmptyState
              title="Your next event starts here"
              body="Create an event and bring your community together."
            />
          );
        })()}
      />
      <CreateEventFab />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    paddingBottom: 110,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  draftCard: {
    gap: Spacing.three,
  },
  draftDetails: {
    gap: Spacing.one,
  },
  continueButton: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});
