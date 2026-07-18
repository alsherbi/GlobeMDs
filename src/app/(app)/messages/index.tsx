import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useConversations } from '@/api/messaging';
import { useSession } from '@/providers/SessionProvider';
import { Avatar, Body, Caption, EmptyState, Pill, Row } from '@/components/ui';
import { useTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

export default function MessagesInbox() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const [showRequests, setShowRequests] = useState(false);
  const conversations = useConversations(showRequests);

  const me = session?.user.id;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Messages' }} />
      <View style={{ flex: 1 }}>
        <Row gap={2} style={{ padding: t.spacing(3) }}>
          <Pill label="Inbox" active={!showRequests} onPress={() => setShowRequests(false)} />
          <Pill label="Requests" active={showRequests} onPress={() => setShowRequests(true)} />
        </Row>
        <FlatList
          data={conversations.data ?? []}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => {
            const others = item.participants.filter((p) => p.profile.id !== me);
            const title = item.is_group
              ? item.title ?? others.map((o) => o.profile.full_name.split(' ')[0]).join(', ')
              : others[0]?.profile.full_name ?? 'Conversation';
            const avatar = item.is_group ? null : others[0]?.profile.avatar_url;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open conversation with ${title}`}
                onPress={() => router.push(`/(app)/messages/${item.id}`)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing(3),
                  paddingHorizontal: t.spacing(4),
                  paddingVertical: t.spacing(3),
                  backgroundColor: item.unread ? t.colors.surfaceAlt : 'transparent',
                }}
              >
                <Avatar url={avatar} name={title} size={44} />
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Body>{title}</Body>
                    {item.lastMessage ? <Caption>{timeAgo(item.lastMessage.created_at)}</Caption> : null}
                  </Row>
                  <Caption>
                    {item.lastMessage
                      ? item.lastMessage.attachment_type
                        ? `📎 ${item.lastMessage.attachment_type === 'image' ? 'Image' : 'PDF'}`
                        : item.lastMessage.body.slice(0, 60)
                      : 'No messages yet'}
                  </Caption>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            conversations.isLoading ? null : (
              <EmptyState
                title={showRequests ? 'No message requests' : 'No messages'}
                hint={
                  showRequests
                    ? 'Requests from physicians outside your network appear here.'
                    : 'Start a conversation from a colleague’s profile.'
                }
              />
            )
          }
          refreshControl={
            <RefreshControl refreshing={conversations.isRefetching} onRefresh={() => conversations.refetch()} />
          }
        />
      </View>
    </>
  );
}
