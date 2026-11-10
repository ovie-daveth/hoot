import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { createQueryClient } from '@/api/query-client';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    const backgroundColor = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;
    void SystemUI.setBackgroundColorAsync(backgroundColor);
  }, [colorScheme]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <AnimatedSplashOverlay />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor:
                colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
            },
            animation: 'fade',
            animationDuration: 420,
          }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
