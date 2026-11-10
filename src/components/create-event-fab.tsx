import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function CreateEventFab() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create event"
      onPress={() => router.push('/create-event')}
      style={({ pressed }) => [
        styles.button,
        Platform.OS === 'web' ? styles.webButton : null,
        pressed && styles.pressed,
      ]}>
      <ThemedText style={styles.plus}>+</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.four,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#222326',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  webButton: {
    bottom: 88,
  },
  plus: {
    color: '#B0B4BA',
    fontSize: 38,
    lineHeight: 44,
    fontWeight: 400,
    marginTop: -4,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
});
