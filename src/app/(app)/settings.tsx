import React from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSession } from '@/providers/SessionProvider';
import { useUpdateNotificationPrefs } from '@/api/notifications';
import { Body, Button, Caption, Card, Heading, Row, Spacer } from '@/components/ui';
import { useTheme } from '@/theme';
import { NotificationPrefs } from '@/types/database';

const PREF_ITEMS: Array<{ key: keyof NotificationPrefs & string; label: string }> = [
  { key: 'push', label: 'Push notifications (master switch)' },
  { key: 'connections', label: 'Connection requests & accepts' },
  { key: 'messages', label: 'Messages' },
  { key: 'reactions', label: 'Reactions to your posts' },
  { key: 'comments', label: 'Comments & replies' },
  { key: 'jobs', label: 'Job matches' },
  { key: 'groups', label: 'Group activity' },
];

export default function SettingsScreen() {
  const t = useTheme();
  const { profile, signOut, session } = useSession();
  const updatePrefs = useUpdateNotificationPrefs();

  const prefs = profile?.notification_prefs;

  const toggle = (key: string, value: boolean) => {
    if (!prefs) return;
    updatePrefs.mutate({ ...prefs, [key]: value });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(3), gap: t.spacing(3) }}>
        <Card>
          <Heading>Notifications</Heading>
          <Spacer size={2} />
          {PREF_ITEMS.map((item) => (
            <Row key={item.key} style={{ justifyContent: 'space-between', paddingVertical: t.spacing(1.5) }}>
              <View style={{ flex: 1 }}>
                <Body>{item.label}</Body>
              </View>
              <Switch
                accessibilityLabel={item.label}
                value={prefs?.[item.key] ?? true}
                onValueChange={(v) => toggle(item.key, v)}
                disabled={!prefs || (item.key !== 'push' && prefs.push === false)}
              />
            </Row>
          ))}
          <Caption>Preferences sync with the web app — they control both push and email digests.</Caption>
        </Card>

        <Card>
          <Heading>Account</Heading>
          <Spacer size={2} />
          <Caption>Signed in as {session?.user.email}</Caption>
          <Caption>Same account as GlobeMDs.com — profile, posts and messages stay in sync.</Caption>
          <Spacer size={3} />
          <Button
            label="Sign out"
            variant="danger"
            onPress={() =>
              Alert.alert('Sign out?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
              ])
            }
          />
        </Card>

        <Caption>
          GlobeMDs is a professional network for physicians. It is not a clinical system: never store patient-identifiable
          information here. To delete your account and data, use the account page on GlobeMDs.com or contact support.
        </Caption>
      </ScrollView>
    </>
  );
}
