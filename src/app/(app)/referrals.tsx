import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useReferralDirectory } from '@/api/search';
import { PersonRow } from '@/components/PersonRow';
import { Button, Caption, EmptyState, Row, TextField } from '@/components/ui';
import { useTheme } from '@/theme';

export default function ReferralsScreen() {
  const t = useTheme();
  const router = useRouter();
  const [specialty, setSpecialty] = useState('');
  const [region, setRegion] = useState('');
  const directory = useReferralDirectory(specialty, region);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Referral directory' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(3), gap: t.spacing(3) }} keyboardShouldPersistTaps="handled">
        <Caption>
          Find verified physicians accepting referrals by specialty and region. List yourself from Edit profile →
          Referral network.
        </Caption>
        <Row gap={2}>
          <TextField placeholder="Specialty" value={specialty} onChangeText={setSpecialty} style={{ flex: 1 }} />
          <TextField placeholder="Region (e.g. CA)" value={region} onChangeText={setRegion} style={{ flex: 1 }} />
        </Row>
        <Button label="Update my referral listing" variant="ghost" onPress={() => router.push('/(app)/profile/edit')} />

        {(directory.data ?? []).map((r) => (
          <PersonRow
            key={r.profile_id}
            id={r.profile_id}
            name={r.full_name}
            headline={r.headline}
            avatarUrl={r.avatar_url}
            subtitle={[r.referral_specialty, r.referral_regions.join(', ')].filter(Boolean).join(' — ')}
          />
        ))}
        {directory.data?.length === 0 ? (
          <EmptyState title="No physicians found" hint="Try a broader specialty or region." />
        ) : null}
      </ScrollView>
    </>
  );
}
