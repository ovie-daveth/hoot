import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function TicketsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">My Tickets</ThemedText>
      <ThemedText themeColor="textSecondary">
        Your event tickets and QR passes land in an upcoming phase.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
});
