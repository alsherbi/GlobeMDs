import React, { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  useApproveMember,
  useGroup,
  useGroupEvents,
  useGroupMembers,
  useGroupMembership,
  useJoinGroup,
  useLeaveGroup,
  useRemoveGroupPost,
  useRemoveMember,
  useTogglePinPost,
} from '@/api/groups';
import { useGroupPosts } from '@/api/posts';
import { PostCard } from '@/components/PostCard';
import { PersonRow } from '@/components/PersonRow';
import { Body, Button, Caption, Card, EmptyState, Heading, Pill, Row, Spacer } from '@/components/ui';
import { useSession } from '@/providers/SessionProvider';
import { useTheme } from '@/theme';

type Tab = 'feed' | 'events' | 'members';

export default function GroupScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isVerified } = useSession();

  const { data: group } = useGroup(id);
  const membership = useGroupMembership(id);
  const { data: posts } = useGroupPosts(membership.data?.isApproved || group?.privacy === 'public' ? id : undefined);
  const { data: events } = useGroupEvents(id);
  const { data: members } = useGroupMembers(id);

  const join = useJoinGroup();
  const leave = useLeaveGroup();
  const approve = useApproveMember();
  const removeMember = useRemoveMember();
  const togglePin = useTogglePinPost();
  const removePost = useRemoveGroupPost();

  const [tab, setTab] = useState<Tab>('feed');

  if (!group) return null;
  const m = membership.data;
  const isAdmin = !!m?.isAdmin;
  const pendingMembers = members?.filter((mm) => mm.status === 'pending') ?? [];

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: group.name }} />
      <FlatList
        data={tab === 'feed' ? posts ?? [] : []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View style={{ padding: t.spacing(3), gap: t.spacing(3) }}>
            <Card>
              <Heading>{group.name}</Heading>
              <Caption>
                {[group.privacy.replace('_', '-'), group.specialty, `${members?.filter((x) => x.status === 'approved').length ?? 0} members`]
                  .filter(Boolean)
                  .join(' · ')}
              </Caption>
              {group.description ? (
                <>
                  <Spacer size={2} />
                  <Body>{group.description}</Body>
                </>
              ) : null}
              <Spacer size={3} />
              {!m?.member ? (
                <Button
                  label={group.privacy === 'public' ? 'Join group' : 'Request to join'}
                  onPress={() =>
                    join.mutate(group, { onError: (e) => Alert.alert('Could not join', e.message) })
                  }
                  disabled={!isVerified || group.privacy === 'invite_only'}
                />
              ) : m.member.status === 'pending' ? (
                <Caption>Membership request pending admin approval.</Caption>
              ) : (
                <Row gap={2}>
                  <Button
                    label="Post to group"
                    onPress={() => router.push({ pathname: '/(app)/compose', params: { groupId: group.id } })}
                    style={{ flex: 1 }}
                  />
                  <Button label="Leave" variant="ghost" onPress={() => leave.mutate(group.id)} style={{ flex: 1 }} />
                </Row>
              )}
            </Card>

            <Row gap={2}>
              <Pill label="Feed" active={tab === 'feed'} onPress={() => setTab('feed')} />
              <Pill label={`Events (${events?.length ?? 0})`} active={tab === 'events'} onPress={() => setTab('events')} />
              <Pill label="Members" active={tab === 'members'} onPress={() => setTab('members')} />
            </Row>

            {isAdmin && pendingMembers.length > 0 ? (
              <Card>
                <Heading>Pending requests</Heading>
                {pendingMembers.map((pm) => (
                  <PersonRow
                    key={pm.profile_id}
                    id={pm.profile.id}
                    name={pm.profile.full_name}
                    headline={pm.profile.headline}
                    avatarUrl={pm.profile.avatar_url}
                    right={
                      <Row gap={2}>
                        <Button
                          label="Approve"
                          onPress={() => approve.mutate({ groupId: group.id, profileId: pm.profile_id })}
                          style={{ minHeight: 36, paddingVertical: 6 }}
                        />
                        <Button
                          label="Remove"
                          variant="ghost"
                          onPress={() => removeMember.mutate({ groupId: group.id, profileId: pm.profile_id })}
                          style={{ minHeight: 36, paddingVertical: 6 }}
                        />
                      </Row>
                    }
                  />
                ))}
              </Card>
            ) : null}

            {tab === 'events'
              ? (events ?? []).map((e) => (
                  <Card key={e.id}>
                    <Body>{e.title}</Body>
                    <Caption>
                      {new Date(e.starts_at).toLocaleString()} {e.location ? `· ${e.location}` : ''}
                    </Caption>
                    {e.description ? <Caption>{e.description}</Caption> : null}
                  </Card>
                ))
              : null}
            {tab === 'events' && (events?.length ?? 0) === 0 ? (
              <EmptyState title="No upcoming events" />
            ) : null}

            {tab === 'members'
              ? (members ?? [])
                  .filter((mm) => mm.status === 'approved')
                  .map((mm) => (
                    <PersonRow
                      key={mm.profile_id}
                      id={mm.profile.id}
                      name={mm.profile.full_name}
                      headline={mm.profile.headline}
                      avatarUrl={mm.profile.avatar_url}
                      verificationStatus={mm.profile.verification_status}
                      subtitle={mm.role === 'admin' ? 'Admin' : undefined}
                      right={
                        isAdmin && mm.role !== 'admin' ? (
                          <Button
                            label="Remove"
                            variant="ghost"
                            onPress={() => removeMember.mutate({ groupId: group.id, profileId: mm.profile_id })}
                            style={{ minHeight: 36, paddingVertical: 6 }}
                          />
                        ) : undefined
                      }
                    />
                  ))
              : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: t.spacing(3), paddingBottom: t.spacing(3) }}>
            <PostCard post={item} />
            {isAdmin ? (
              <Row gap={2} style={{ marginTop: t.spacing(1) }}>
                <Button
                  label={item.pinned_at ? 'Unpin' : 'Pin'}
                  variant="ghost"
                  onPress={() => togglePin.mutate({ postId: item.id, pinned: !!item.pinned_at })}
                  style={{ minHeight: 32, paddingVertical: 4 }}
                />
                <Button
                  label="Remove post"
                  variant="ghost"
                  onPress={() =>
                    Alert.alert('Remove post?', 'This removes the post for everyone in the group.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removePost.mutate(item.id) },
                    ])
                  }
                  style={{ minHeight: 32, paddingVertical: 4 }}
                />
              </Row>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          tab === 'feed' && (m?.isApproved || group.privacy === 'public') ? (
            <EmptyState title="No posts yet" hint="Be the first to start a discussion." />
          ) : null
        }
        contentContainerStyle={{ paddingBottom: t.spacing(8) }}
      />
    </>
  );
}
