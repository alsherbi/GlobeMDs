import React from 'react';
import { FlatList, View } from 'react-native';
import { Stack } from 'expo-router';
import { useBookmarkedPosts } from '@/api/posts';
import { PostCard } from '@/components/PostCard';
import { EmptyState } from '@/components/ui';
import { useTheme } from '@/theme';

export default function BookmarksScreen() {
  const t = useTheme();
  const { data: posts, isLoading } = useBookmarkedPosts();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Saved posts' }} />
      <FlatList
        data={posts ?? []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: t.spacing(3), paddingTop: t.spacing(3) }}>
            <PostCard post={item} />
          </View>
        )}
        ListEmptyComponent={
          isLoading ? null : <EmptyState title="No saved posts" hint="Tap the bookmark icon on any post to save it." />
        }
        contentContainerStyle={{ paddingBottom: t.spacing(8) }}
      />
    </>
  );
}
