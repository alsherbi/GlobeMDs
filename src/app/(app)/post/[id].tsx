import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAddComment, useComments, usePost } from '@/api/posts';
import { PostCard } from '@/components/PostCard';
import { Avatar, Body, Button, Caption, EmptyState, Row, TextField } from '@/components/ui';
import { useSession } from '@/providers/SessionProvider';
import { useTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

export default function PostDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isVerified } = useSession();
  const { data: post } = usePost(id);
  const { data: comments } = useComments(id);
  const addComment = useAddComment();
  const [draft, setDraft] = useState('');

  const send = () => {
    if (!draft.trim() || !id) return;
    addComment.mutate({ postId: id, body: draft.trim() });
    setDraft('');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Post' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={comments ?? []}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={
            post ? (
              <View style={{ padding: t.spacing(3) }}>
                <PostCard post={post} detail />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: 'row',
                gap: t.spacing(3),
                paddingHorizontal: t.spacing(4),
                paddingVertical: t.spacing(2),
                marginLeft: item.parent_id ? t.spacing(8) : 0,
              }}
            >
              <Avatar url={item.author.avatar_url} name={item.author.full_name} size={32} />
              <View style={{ flex: 1 }}>
                <Row gap={2}>
                  <Body>{item.author.full_name}</Body>
                  <Caption>{timeAgo(item.created_at)}</Caption>
                </Row>
                <Body>{item.body}</Body>
              </View>
            </View>
          )}
          ListEmptyComponent={
            post ? <EmptyState title="No comments yet" hint="Start the discussion." /> : null
          }
          contentContainerStyle={{ paddingBottom: t.spacing(4) }}
        />
        {isVerified ? (
          <Row gap={2} style={{ padding: t.spacing(3), borderTopWidth: 1, borderTopColor: t.colors.border }}>
            <View style={{ flex: 1 }}>
              <TextField placeholder="Add a comment…" value={draft} onChangeText={setDraft} />
            </View>
            <Button label="Send" onPress={send} loading={addComment.isPending} disabled={!draft.trim()} />
          </Row>
        ) : (
          <View style={{ padding: t.spacing(3) }}>
            <Caption>Verify your credentials to join the discussion.</Caption>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}
