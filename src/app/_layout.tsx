import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';
import { queryClient, asyncStoragePersister } from '@/lib/queryClient';
import { SessionProvider, useSession } from '@/providers/SessionProvider';
import { registerForPushNotifications } from '@/lib/push';
import { useTheme } from '@/theme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(app)/(tabs)');
    }
  }, [session, loading, segments, router]);

  useEffect(() => {
    if (session) {
      registerForPushNotifications().catch(() => {
        // push is best-effort; the in-app notification center still works
      });
    }
  }, [session]);

  // Deep link from a push notification tap into the relevant screen.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        kind?: string;
        entity?: { post_id?: string; conversation_id?: string; job_id?: string; group_id?: string };
      };
      const entity = data?.entity ?? {};
      if (entity.conversation_id) router.push(`/(app)/messages/${entity.conversation_id}`);
      else if (entity.post_id) router.push(`/(app)/post/${entity.post_id}`);
      else if (entity.job_id) router.push(`/(app)/job/${entity.job_id}`);
      else if (entity.group_id) router.push(`/(app)/group/${entity.group_id}`);
      else router.push('/(app)/(tabs)/notifications');
    });
    return () => sub.remove();
  }, [router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const t = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
        <SessionProvider>
          <AuthGate>
            <StatusBar style="auto" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: t.colors.background },
              }}
            />
          </AuthGate>
        </SessionProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
