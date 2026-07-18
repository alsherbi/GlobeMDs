import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/providers/SessionProvider';
import { useProfileDetails, profileCompleteness } from '@/api/profiles';
import { useHasPremium } from '@/api/premium';
import { Avatar, Body, Caption, Card, Heading, Row, Spacer, VerifiedBadge } from '@/components/ui';
import { useTheme } from '@/theme';

function MenuRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing(3),
        paddingVertical: t.spacing(3),
        paddingHorizontal: t.spacing(4),
      }}
    >
      <Ionicons name={icon} size={20} color={t.colors.textMuted} />
      <Body>{label}</Body>
    </Pressable>
  );
}

export default function MeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { profile, session } = useSession();
  const { data: details } = useProfileDetails(session?.user.id);
  const hasPremium = useHasPremium();

  const completeness = profileCompleteness(profile, details);

  return (
    <ScrollView contentContainerStyle={{ padding: t.spacing(3), gap: t.spacing(3) }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View my profile"
        onPress={() => session && router.push(`/(app)/profile/${session.user.id}`)}
      >
        <Card>
          <Row gap={3}>
            <Avatar url={profile?.avatar_url} name={profile?.full_name ?? '?'} size={56} />
            <View style={{ flex: 1 }}>
              <Row gap={2}>
                <Heading>{profile?.full_name ?? '…'}</Heading>
                <VerifiedBadge status={profile?.verification_status ?? 'unverified'} />
              </Row>
              <Caption>{profile?.headline || 'Add a headline'}</Caption>
              {hasPremium ? <Caption>⭐ Premium member</Caption> : null}
            </View>
          </Row>
          <Spacer size={3} />
          {/* profile completeness meter */}
          <View
            accessibilityLabel={`Profile ${Math.round(completeness * 100)} percent complete`}
            style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' }}
          >
            <View
              style={{
                width: `${Math.round(completeness * 100)}%`,
                height: '100%',
                backgroundColor: completeness >= 0.8 ? t.colors.success : t.colors.accent,
              }}
            />
          </View>
          <Spacer size={1} />
          <Caption>Profile {Math.round(completeness * 100)}% complete</Caption>
        </Card>
      </Pressable>

      <Card style={{ paddingVertical: 0, paddingHorizontal: 0 }}>
        <MenuRow icon="create-outline" label="Edit profile" onPress={() => router.push('/(app)/profile/edit')} />
        <MenuRow icon="shield-checkmark-outline" label="Credential verification" onPress={() => router.push('/(app)/verification')} />
        <MenuRow icon="school-outline" label="CME tracking" onPress={() => router.push('/(app)/cme')} />
        <MenuRow icon="bookmark-outline" label="Saved posts" onPress={() => router.push('/(app)/bookmarks')} />
        <MenuRow icon="git-network-outline" label="Referral directory" onPress={() => router.push('/(app)/referrals')} />
        <MenuRow icon="medkit-outline" label="ICD-10 quick reference" onPress={() => router.push('/(app)/tools/icd10')} />
        <MenuRow icon="star-outline" label={hasPremium ? 'Premium (active)' : 'GlobeMDs Premium'} onPress={() => router.push('/(app)/premium')} />
        <MenuRow icon="settings-outline" label="Settings" onPress={() => router.push('/(app)/settings')} />
      </Card>
    </ScrollView>
  );
}
