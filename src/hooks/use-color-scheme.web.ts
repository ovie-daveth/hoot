import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const emptySubscribe = () => () => {};

export function useColorScheme() {
  const colorScheme = useRNColorScheme();

  return useSyncExternalStore(emptySubscribe, () => colorScheme, () => 'light');
}
