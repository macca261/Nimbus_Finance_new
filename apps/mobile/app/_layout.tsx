import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  return (
    <PaperProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </PaperProvider>
  );
}


