// Shared UI primitives. Every screen builds from these so typography, color
// contrast (WCAG AA) and accessibility labels stay consistent.

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.surface,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor: t.colors.border,
          padding: t.spacing(4),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[t.type.title, { color: t.colors.text }]}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[t.type.heading, { color: t.colors.text }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, numberOfLines }: { children: React.ReactNode; muted?: boolean; numberOfLines?: number }) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[t.type.body, { color: muted ? t.colors.textMuted : t.colors.text }]}>
      {children}
    </Text>
  );
}

export function Caption({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[t.type.caption, { color: t.colors.textMuted }]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.colors.primary
    : variant === 'danger' ? t.colors.danger
    : variant === 'secondary' ? t.colors.surfaceAlt
    : 'transparent';
  const fg =
    variant === 'primary' ? t.colors.primaryText
    : variant === 'danger' ? '#fff'
    : t.colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          borderRadius: t.radius.sm,
          paddingVertical: t.spacing(2.5),
          paddingHorizontal: t.spacing(4),
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 44,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: t.colors.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '600', fontSize: 15 }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function TextField(props: TextInputProps & { label?: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: t.spacing(1) }}>
      {label ? <Caption>{label}</Caption> : null}
      <TextInput
        accessibilityLabel={label ?? props.placeholder}
        placeholderTextColor={t.colors.textMuted}
        style={[
          {
            borderWidth: 1,
            borderColor: t.colors.border,
            borderRadius: t.radius.sm,
            backgroundColor: t.colors.surface,
            color: t.colors.text,
            paddingHorizontal: t.spacing(3),
            paddingVertical: t.spacing(2.5),
            fontSize: 15,
            minHeight: 44,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function Avatar({ url, name, size = 44 }: { url?: string | null; name: string; size?: number }) {
  const t = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        accessibilityLabel={`${name} profile photo`}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.colors.surfaceAlt }}
        cachePolicy="memory-disk"
        transition={100}
      />
    );
  }
  return (
    <View
      accessibilityLabel={`${name} initials`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: t.colors.primaryText, fontWeight: '700', fontSize: size * 0.38 }}>{initials || '?'}</Text>
    </View>
  );
}

export function VerifiedBadge({ status }: { status: string }) {
  const t = useTheme();
  if (status !== 'verified') return null;
  return (
    <View
      accessibilityLabel="Verified physician"
      style={{
        backgroundColor: t.colors.verified,
        borderRadius: t.radius.full,
        paddingHorizontal: t.spacing(2),
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓ MD Verified</Text>
    </View>
  );
}

export function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={{
        backgroundColor: active ? t.colors.primary : t.colors.surfaceAlt,
        borderRadius: t.radius.full,
        paddingHorizontal: t.spacing(3),
        paddingVertical: t.spacing(1.5),
      }}
    >
      <Text style={{ color: active ? t.colors.primaryText : t.colors.text, fontSize: 13, fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: t.spacing(10), gap: t.spacing(2) }}>
      <Heading>{title}</Heading>
      {hint ? <Caption>{hint}</Caption> : null}
    </View>
  );
}

export function Spacer({ size = 4 }: { size?: number }) {
  const t = useTheme();
  return <View style={{ height: t.spacing(size) }} />;
}

export function Row({ children, gap = 2, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: t.spacing(gap) }, style]}>{children}</View>;
}
