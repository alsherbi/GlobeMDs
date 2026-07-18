import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { useEntitlements, useHasPremium, useProfileViewers } from '@/api/premium';
import { PersonRow } from '@/components/PersonRow';
import { Body, Button, Caption, Card, Heading, Spacer, Title } from '@/components/ui';
import { useTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

const FEATURES = [
  'See who viewed your profile',
  'Advanced search filters (specialty, license state, language, availability)',
  'Message physicians outside your network (no connection required)',
  'Analytics on your posts and profile reach',
];

export default function PremiumScreen() {
  const t = useTheme();
  const hasPremium = useHasPremium();
  const { data: entitlements } = useEntitlements();
  const viewers = useProfileViewers(hasPremium);

  const purchase = () => {
    // RevenueCat's native SDK (react-native-purchases) is added in the EAS
    // dev-client build (it cannot run in Expo Go). Purchases flow:
    //   Purchases.configure + logIn(session.user.id) → getOfferings →
    //   purchasePackage → revenuecat-webhook edge function writes the
    //   entitlement row that this screen reads.
    Alert.alert(
      'Purchases require the full build',
      'Premium subscriptions are available in the App Store / Play Store build of GlobeMDs. If you subscribed on the web, your Premium unlocks here automatically.',
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'GlobeMDs Premium' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(3), gap: t.spacing(3) }}>
        <Card>
          <Title>⭐ Premium</Title>
          <Spacer size={2} />
          {FEATURES.map((f) => (
            <Body key={f}>• {f}</Body>
          ))}
          <Spacer size={3} />
          {hasPremium ? (
            <>
              <Body>You have an active Premium subscription.</Body>
              {entitlements?.map((e) => (
                <Caption key={e.id}>
                  {e.product_id} — {e.status}
                  {e.expires_at ? ` (renews/expires ${new Date(e.expires_at).toLocaleDateString()})` : ''} via {e.source}
                </Caption>
              ))}
            </>
          ) : (
            <Button label="Subscribe" onPress={purchase} />
          )}
        </Card>

        {hasPremium ? (
          <Card style={{ paddingHorizontal: 0 }}>
            <Heading> Who viewed your profile</Heading>
            <Spacer size={2} />
            {(viewers.data ?? []).map((v) => (
              <PersonRow
                key={`${v.viewer_id}-${v.viewed_at}`}
                id={v.viewer_id}
                name={v.full_name}
                headline={v.headline}
                avatarUrl={v.avatar_url}
                subtitle={`Viewed ${timeAgo(v.viewed_at)}`}
              />
            ))}
            {viewers.data?.length === 0 ? <Caption> No profile views yet.</Caption> : null}
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
