// Shown across the app while the user is not yet verified. RLS is the real
// enforcement (unverified users cannot post/message/connect); this banner
// explains why and routes them into the verification flow.

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/providers/SessionProvider';
import { useTheme } from '@/theme';

export function VerificationBanner() {
  const { profile, isVerified } = useSession();
  const t = useTheme();
  const router = useRouter();

  if (!profile || isVerified) return null;

  const copy =
    profile.verification_status === 'pending_review'
      ? 'Credentials under review — you can browse and build your profile, but posting and messaging unlock once approved.'
      : profile.verification_status === 'rejected'
        ? 'Verification was not approved. Tap to re-submit your credentials.'
        : 'Verify your medical credentials to unlock posting, messaging and connections.';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open credential verification"
      onPress={() => router.push('/(app)/verification')}
      style={{
        backgroundColor: profile.verification_status === 'rejected' ? t.colors.danger : t.colors.warning,
        paddingHorizontal: t.spacing(4),
        paddingVertical: t.spacing(2),
      }}
    >
      <View>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{copy}</Text>
      </View>
    </Pressable>
  );
}
