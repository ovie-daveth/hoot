import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function HostScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">Host</ThemedText>
      <ThemedText themeColor="textSecondary">
        Create and manage your events, attendees, and earnings in an upcoming phase.
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
