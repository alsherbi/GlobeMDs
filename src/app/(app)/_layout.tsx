import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export default function AppLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: t.colors.surface },
        headerTintColor: t.colors.text,
        contentStyle: { backgroundColor: t.colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="compose" options={{ presentation: 'modal', headerShown: true, title: 'New post' }} />
    </Stack>
  );
}
