// React Query setup with offline support:
// - cache persisted to AsyncStorage so last-loaded feed/profile/messages
//   survive restarts and render offline
// - onlineManager wired to NetInfo so paused mutations resume on reconnect

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  }),
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000, // keep a day of cache for offline reads
      retry: 2,
    },
    mutations: {
      networkMode: 'online', // queue while offline, fire on reconnect
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'globemds-query-cache',
  throttleTime: 2_000,
});
