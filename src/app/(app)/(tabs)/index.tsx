import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FeedMode, useFeed, useFeedRealtime } from '@/api/posts';
import { PostCard } from '@/components/PostCard';
import { VerificationBanner } from '@/components/VerificationBanner';
import { Avatar, Body, EmptyState, Pill, Row } from '@/components/ui';
import { useSession } from '@/providers/SessionProvider';
import { useTheme } from '@/theme';

export default function HomeFeed() {
  const t = useTheme();
  const router = useRouter();
  const { profile, isVerified } = useSession();
  const [mode, setMode] = useState<FeedMode>('chrono');
  const feed = useFeed(mode);
  useFeedRealtime();

  const posts = feed.data?.pages.flat() ?? [];

  return (
    <View style={{ flex: 1 }}>
      <VerificationBanner />
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: t.spacing(3), paddingTop: t.spacing(3) }}>
            <PostCard post={item} />
          </View>
        )}
        ListHeaderComponent={
          <View style={{ padding: t.spacing(3), gap: t.spacing(3) }}>
            {isVerified ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start a post"
                onPress={() => router.push('/(app)/compose')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing(3),
                  backgroundColor: t.colors.surface,
                  borderWidth: 1,
                  borderColor: t.colors.border,
                  borderRadius: t.radius.full,
                  paddingVertical: t.spacing(2.5),
                  paddingHorizontal: t.spacing(4),
                }}
              >
                <Avatar url={profile?.avatar_url} name={profile?.full_name ?? '?'} size={32} />
                <Body muted>Share an update, case, or article…</Body>
              </Pressable>
            ) : null}
            <Row gap={2}>
              <Pill label="Recent" active={mode === 'chrono'} onPress={() => setMode('chrono')} />
              <Pill label="Top" active={mode === 'top'} onPress={() => setMode('top')} />
              <View style={{ flex: 1 }} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Groups"
                onPress={() => router.push('/(app)/groups')}
              >
                <Ionicons name="albums-outline" size={22} color={t.colors.textMuted} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Saved posts"
                onPress={() => router.push('/(app)/bookmarks')}
              >
                <Ionicons name="bookmark-outline" size={20} color={t.colors.textMuted} />
              </Pressable>
            </Row>
          </View>
        }
        ListEmptyComponent={
          feed.isLoading ? null : (
            <EmptyState
              title="Your feed is quiet"
              hint="Connect with colleagues or join a specialty group to see posts here."
            />
          )
        }
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} />}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: t.spacing(8) }}
      />
    </View>
  );
}
