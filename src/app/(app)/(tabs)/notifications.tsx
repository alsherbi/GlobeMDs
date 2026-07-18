import React from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useMarkAllNotificationsRead,
  useNotifications,
  useNotificationsRealtime,
} from '@/api/notifications';
import { Avatar, Body, Button, Caption, EmptyState, Row } from '@/components/ui';
import { useTheme } from '@/theme';
import { AppNotification } from '@/types/database';
import { timeAgo } from '@/utils/time';

const KIND_TEXT: Record<AppNotification['kind'], string> = {
  connection_request: 'sent you a connection request',
  connection_accepted: 'accepted your connection request',
  new_follower: 'started following you',
  post_reaction: 'reacted to your post',
  post_comment: 'commented on your post',
  comment_reply: 'replied to your comment',
  post_reshare: 'reshared your post',
  message: 'sent you a message',
  group_invite: 'invited you to a group',
  group_join_approved: 'approved your group membership',
  job_match: 'New job matches your profile',
  system: 'GlobeMDs update',
};

export default function NotificationsScreen() {
  const t = useTheme();
  const router = useRouter();
  const notifications = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  useNotificationsRealtime();

  const open = (n: AppNotification) => {
    if (n.entity.conversation_id) router.push(`/(app)/messages/${n.entity.conversation_id}`);
    else if (n.entity.post_id) router.push(`/(app)/post/${n.entity.post_id}`);
    else if (n.entity.job_id) router.push(`/(app)/job/${n.entity.job_id}`);
    else if (n.entity.group_id) router.push(`/(app)/group/${n.entity.group_id}`);
    else if (n.entity.connection_id) router.push('/(app)/(tabs)/network');
    else if (n.actor_id) router.push(`/(app)/profile/${n.actor_id}`);
  };

  return (
    <FlatList
      data={notifications.data ?? []}
      keyExtractor={(n) => n.id}
      ListHeaderComponent={
        (notifications.data?.some((n) => !n.read_at) ?? false) ? (
          <View style={{ padding: t.spacing(3) }}>
            <Button label="Mark all as read" variant="ghost" onPress={() => markAllRead.mutate()} />
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open notification"
          onPress={() => open(item)}
          style={{
            backgroundColor: item.read_at ? 'transparent' : t.colors.surfaceAlt,
            paddingHorizontal: t.spacing(4),
            paddingVertical: t.spacing(3),
          }}
        >
          <Row gap={3}>
            <Avatar url={item.actor?.avatar_url} name={item.actor?.full_name ?? 'GlobeMDs'} size={40} />
            <View style={{ flex: 1 }}>
              <Body>
                {item.actor ? `${item.actor.full_name} ` : ''}
                {KIND_TEXT[item.kind]}
              </Body>
              <Caption>{timeAgo(item.created_at)}</Caption>
            </View>
          </Row>
        </Pressable>
      )}
      ListEmptyComponent={
        notifications.isLoading ? null : (
          <EmptyState title="No notifications" hint="Activity on your posts and connections shows up here." />
        )
      }
      refreshControl={
        <RefreshControl refreshing={notifications.isRefetching} onRefresh={() => notifications.refetch()} />
      }
    />
  );
}
