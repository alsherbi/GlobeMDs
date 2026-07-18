import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import {
  useConnectionSuggestions,
  useIncomingRequests,
  useMyConnections,
  useRespondConnectionRequest,
  useSendConnectionRequest,
} from '@/api/network';
import { PersonRow } from '@/components/PersonRow';
import { VerificationBanner } from '@/components/VerificationBanner';
import { Button, Caption, EmptyState, Heading, Row, Spacer } from '@/components/ui';
import { useTheme } from '@/theme';

export default function NetworkScreen() {
  const t = useTheme();
  const incoming = useIncomingRequests();
  const connections = useMyConnections();
  const suggestions = useConnectionSuggestions();
  const respond = useRespondConnectionRequest();
  const send = useSendConnectionRequest();

  const refreshing = incoming.isRefetching || connections.isRefetching || suggestions.isRefetching;
  const refetchAll = () => {
    incoming.refetch();
    connections.refetch();
    suggestions.refetch();
  };

  return (
    <View style={{ flex: 1 }}>
      <VerificationBanner />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} />}
        contentContainerStyle={{ paddingVertical: t.spacing(3) }}
      >
        {incoming.data && incoming.data.length > 0 ? (
          <View>
            <View style={{ paddingHorizontal: t.spacing(4) }}>
              <Heading>Invitations</Heading>
            </View>
            {incoming.data.map((req) => (
              <PersonRow
                key={req.id}
                id={req.requester.id}
                name={req.requester.full_name}
                headline={req.requester.headline}
                avatarUrl={req.requester.avatar_url}
                verificationStatus={req.requester.verification_status}
                right={
                  <Row gap={2}>
                    <Button
                      label="Accept"
                      onPress={() => respond.mutate({ requestId: req.id, accept: true })}
                      style={{ minHeight: 36, paddingVertical: 6 }}
                    />
                    <Button
                      label="Decline"
                      variant="ghost"
                      onPress={() => respond.mutate({ requestId: req.id, accept: false })}
                      style={{ minHeight: 36, paddingVertical: 6 }}
                    />
                  </Row>
                }
              />
            ))}
            <Spacer size={4} />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: t.spacing(4) }}>
          <Heading>People you may know</Heading>
          <Caption>Based on mutual connections and shared specialty</Caption>
        </View>
        {suggestions.data?.length === 0 ? (
          <EmptyState title="No suggestions yet" hint="Suggestions appear as the network grows." />
        ) : null}
        {suggestions.data?.map((s) => (
          <PersonRow
            key={s.profile_id}
            id={s.profile_id}
            name={s.full_name}
            headline={s.headline}
            avatarUrl={s.avatar_url}
            subtitle={s.mutual_count > 0 ? `${s.mutual_count} mutual connection${s.mutual_count === 1 ? '' : 's'}` : undefined}
            right={
              <Button
                label="Connect"
                variant="secondary"
                onPress={() => send.mutate(s.profile_id)}
                style={{ minHeight: 36, paddingVertical: 6 }}
              />
            }
          />
        ))}

        <Spacer size={4} />
        <View style={{ paddingHorizontal: t.spacing(4) }}>
          <Heading>Connections ({connections.data?.length ?? 0})</Heading>
        </View>
        {connections.data?.map((c) => (
          <PersonRow
            key={c.id}
            id={c.peer.id}
            name={c.peer.full_name}
            headline={c.peer.headline}
            avatarUrl={c.peer.avatar_url}
            verificationStatus={c.peer.verification_status}
          />
        ))}
      </ScrollView>
    </View>
  );
}
