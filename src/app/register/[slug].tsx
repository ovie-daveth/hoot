import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return (
    <ThemedView style={styles.container}>
      <Button variant="secondary" onPress={() => router.back()} style={styles.backButton}>
        Back
      </Button>
      <ThemedText type="subtitle">Register</ThemedText>
      <ThemedText themeColor="textSecondary">
        Guest registration flow{slug ? ` for event ${slug}` : ''} lands in an upcoming phase.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
});
