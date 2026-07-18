import React, { useEffect } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '@/providers/SessionProvider';
import { useProfile, useProfileDetails, useRecordProfileView } from '@/api/profiles';
import {
  useMutualCount,
  useRelationship,
  useRespondConnectionRequest,
  useSendConnectionRequest,
  useToggleFollow,
} from '@/api/network';
import { useStartDirectConversation } from '@/api/messaging';
import { useAuthorPosts } from '@/api/posts';
import { PostCard } from '@/components/PostCard';
import { Avatar, Body, Button, Caption, Card, Heading, Pill, Row, Spacer, Title, VerifiedBadge } from '@/components/ui';
import { useTheme } from '@/theme';

const OPEN_TO_LABEL: Record<string, string> = {
  consulting: 'Consulting',
  locum: 'Locum tenens',
  telemedicine: 'Telemedicine',
  mentorship: 'Mentorship',
};

export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isVerified } = useSession();
  const isSelf = session?.user.id === id;

  const { data: profile } = useProfile(id);
  const { data: details } = useProfileDetails(id);
  const { data: posts } = useAuthorPosts(id);
  const relationship = useRelationship(isSelf ? undefined : id);
  const { data: mutuals } = useMutualCount(isSelf ? undefined : id);

  const sendRequest = useSendConnectionRequest();
  const respond = useRespondConnectionRequest();
  const toggleFollow = useToggleFollow();
  const startConversation = useStartDirectConversation();
  const recordView = useRecordProfileView();

  useEffect(() => {
    if (id && !isSelf) recordView.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isSelf]);

  if (!profile) return null;

  const rel = relationship.data;

  const onMessage = () => {
    startConversation.mutate(id!, {
      onSuccess: (conversationId) => router.push(`/(app)/messages/${conversationId}`),
      onError: (e) => Alert.alert('Cannot message', e.message),
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: profile.full_name }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(3), gap: t.spacing(3) }}>
        <Card>
          <Row gap={4}>
            <Avatar url={profile.avatar_url} name={profile.full_name} size={72} />
            <View style={{ flex: 1 }}>
              <Row gap={2} style={{ flexWrap: 'wrap' }}>
                <Title>{profile.full_name}</Title>
                <VerifiedBadge status={profile.verification_status} />
              </Row>
              {profile.headline ? <Body>{profile.headline}</Body> : null}
              <Caption>
                {[profile.specialty, profile.subspecialty].filter(Boolean).join(' · ')}
              </Caption>
              {!isSelf && (mutuals ?? 0) > 0 ? (
                <Caption>{mutuals} mutual connection{mutuals === 1 ? '' : 's'}</Caption>
              ) : null}
            </View>
          </Row>

          {profile.open_to.length > 0 ? (
            <>
              <Spacer size={3} />
              <Row gap={2} style={{ flexWrap: 'wrap' }}>
                {profile.open_to.map((o) => (
                  <Pill key={o} label={`Open to: ${OPEN_TO_LABEL[o] ?? o}`} />
                ))}
              </Row>
            </>
          ) : null}

          {!isSelf ? (
            <>
              <Spacer size={4} />
              <Row gap={2}>
                {rel?.kind === 'connected' ? (
                  <Button label="Connected ✓" variant="secondary" onPress={() => {}} style={{ flex: 1 }} />
                ) : rel?.kind === 'outgoing_pending' ? (
                  <Button label="Request sent" variant="secondary" onPress={() => {}} disabled style={{ flex: 1 }} />
                ) : rel?.kind === 'incoming_pending' ? (
                  <Button
                    label="Accept request"
                    onPress={() => respond.mutate({ requestId: rel.connectionId, accept: true })}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Button
                    label="Connect"
                    onPress={() =>
                      sendRequest.mutate(id!, {
                        onError: (e) => Alert.alert('Cannot connect', e.message),
                      })
                    }
                    disabled={!isVerified}
                    style={{ flex: 1 }}
                  />
                )}
                <Button
                  label={rel?.following ? 'Following' : 'Follow'}
                  variant="ghost"
                  onPress={() => toggleFollow.mutate({ targetId: id!, following: !!rel?.following })}
                  disabled={!isVerified}
                  style={{ flex: 1 }}
                />
                <Button label="Message" variant="secondary" onPress={onMessage} disabled={!isVerified} style={{ flex: 1 }} />
              </Row>
              {!isVerified ? <Caption>Verify your credentials to connect and message.</Caption> : null}
            </>
          ) : (
            <>
              <Spacer size={4} />
              <Button label="Edit profile" variant="secondary" onPress={() => router.push('/(app)/profile/edit')} />
            </>
          )}
        </Card>

        {profile.bio ? (
          <Card>
            <Heading>About</Heading>
            <Spacer size={2} />
            <Body>{profile.bio}</Body>
          </Card>
        ) : null}

        {profile.accepting_referrals ? (
          <Card>
            <Heading>Accepting referrals</Heading>
            <Spacer size={1} />
            <Caption>
              {[profile.referral_specialty, profile.referral_regions.join(', ')].filter(Boolean).join(' — ')}
            </Caption>
          </Card>
        ) : null}

        {(details?.affiliations.length ?? 0) > 0 ? (
          <Card>
            <Heading>Experience</Heading>
            <Spacer size={2} />
            {details!.affiliations.map((a) => (
              <View key={a.id} style={{ paddingVertical: t.spacing(1.5) }}>
                <Body>{a.role_title ?? 'Physician'}</Body>
                <Caption>
                  {a.institution?.name}
                  {a.is_current ? ' · Current' : a.end_year ? ` · until ${a.end_year}` : ''}
                </Caption>
              </View>
            ))}
          </Card>
        ) : null}

        {(details?.education.length ?? 0) > 0 ? (
          <Card>
            <Heading>Education & training</Heading>
            <Spacer size={2} />
            {details!.education.map((e) => (
              <View key={e.id} style={{ paddingVertical: t.spacing(1.5) }}>
                <Body>{e.institution}</Body>
                <Caption>
                  {[e.degree, e.kind, [e.start_year, e.end_year].filter(Boolean).join('–')].filter(Boolean).join(' · ')}
                </Caption>
              </View>
            ))}
          </Card>
        ) : null}

        {(details?.boardCertifications.length ?? 0) > 0 || (details?.licenses.length ?? 0) > 0 ? (
          <Card>
            <Heading>Licenses & certifications</Heading>
            <Spacer size={2} />
            {details!.licenses.map((l) => (
              <Caption key={l.id}>
                Medical license — {l.state}
                {l.expires_on ? ` (expires ${l.expires_on})` : ''}
              </Caption>
            ))}
            {details!.boardCertifications.map((c) => (
              <Caption key={c.id}>
                {c.board_name}: {c.certification}
                {c.year_certified ? ` (${c.year_certified})` : ''}
              </Caption>
            ))}
          </Card>
        ) : null}

        {(details?.publications.length ?? 0) > 0 ? (
          <Card>
            <Heading>Publications</Heading>
            <Spacer size={2} />
            {details!.publications.map((p) => (
              <View key={p.id} style={{ paddingVertical: t.spacing(1.5) }}>
                <Body numberOfLines={2}>{p.title}</Body>
                <Caption>{[p.journal, p.year, p.pmid ? `PMID ${p.pmid}` : null].filter(Boolean).join(' · ')}</Caption>
              </View>
            ))}
          </Card>
        ) : null}

        {profile.languages.length > 0 ? (
          <Card>
            <Heading>Languages</Heading>
            <Spacer size={1} />
            <Caption>{profile.languages.join(', ')}</Caption>
          </Card>
        ) : null}

        {(posts?.length ?? 0) > 0 ? (
          <>
            <Heading>Activity</Heading>
            {posts!.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
