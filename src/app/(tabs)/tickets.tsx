import { StyleSheet } from 'react-native';

import { CreateEventFab } from '@/components/create-event-fab';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function TicketsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="subtitle">My Tickets</ThemedText>
        <ThemedText themeColor="textSecondary">
          Your event tickets and QR passes land in an upcoming phase.
        </ThemedText>
      </ThemedView>
      <CreateEventFab />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
});
