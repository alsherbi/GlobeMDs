import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useUnreadNotificationCount } from '@/api/notifications';

export default function TabsLayout() {
  const t = useTheme();
  const router = useRouter();
  const { data: unread } = useUnreadNotificationCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: t.colors.surface },
        headerTintColor: t.colors.text,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarStyle: { backgroundColor: t.colors.surface, borderTopColor: t.colors.border },
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: t.spacing(4), marginRight: t.spacing(4) }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search"
              onPress={() => router.push('/(app)/search')}
            >
              <Ionicons name="search" size={22} color={t.colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Messages"
              onPress={() => router.push('/(app)/messages')}
            >
              <Ionicons name="chatbubbles-outline" size={22} color={t.colors.text} />
            </Pressable>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: 'Network',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarBadge: unread ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
