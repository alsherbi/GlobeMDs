import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Avatar, Body, Caption, Row, VerifiedBadge } from '@/components/ui';
import { useTheme } from '@/theme';

export interface PersonRowProps {
  id: string;
  name: string;
  headline?: string | null;
  avatarUrl?: string | null;
  verificationStatus?: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function PersonRow({ id, name, headline, avatarUrl, verificationStatus, subtitle, right }: PersonRowProps) {
  const router = useRouter();
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View profile of ${name}`}
      onPress={() => router.push(`/(app)/profile/${id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing(3),
        paddingVertical: t.spacing(2.5),
        paddingHorizontal: t.spacing(4),
      }}
    >
      <Avatar url={avatarUrl} name={name} />
      <View style={{ flex: 1 }}>
        <Row gap={1.5}>
          <Body>{name}</Body>
          {verificationStatus ? <VerifiedBadge status={verificationStatus} /> : null}
        </Row>
        {headline ? <Caption>{headline}</Caption> : null}
        {subtitle ? <Caption>{subtitle}</Caption> : null}
      </View>
      {right}
    </Pressable>
  );
}
