import React from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  useInstitution,
  useInstitutionFollow,
  useInstitutionJobs,
  useInstitutionPeople,
  useToggleInstitutionFollow,
} from '@/api/institutions';
import { PersonRow } from '@/components/PersonRow';
import { Avatar, Body, Button, Caption, Card, Heading, Row, Spacer, Title } from '@/components/ui';
import { useTheme } from '@/theme';

export default function InstitutionScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: institution } = useInstitution(id);
  const { data: jobs } = useInstitutionJobs(id);
  const { data: people } = useInstitutionPeople(id);
  const { data: following } = useInstitutionFollow(id);
  const toggleFollow = useToggleInstitutionFollow();

  if (!institution) return null;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: institution.name }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(3), gap: t.spacing(3) }}>
        <Card>
          <Row gap={4}>
            <Avatar url={institution.logo_url} name={institution.name} size={56} />
            <Row style={{ flex: 1, flexWrap: 'wrap' }}>
              <Title>{institution.name}</Title>
            </Row>
          </Row>
          <Caption>
            {[institution.kind, [institution.city, institution.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
          </Caption>
          {institution.description ? (
            <>
              <Spacer size={2} />
              <Body>{institution.description}</Body>
            </>
          ) : null}
          <Spacer size={3} />
          <Row gap={2}>
            <Button
              label={following ? 'Following' : 'Follow'}
              variant={following ? 'secondary' : 'primary'}
              onPress={() => toggleFollow.mutate({ institutionId: institution.id, following: !!following })}
              style={{ flex: 1 }}
            />
            {institution.website ? (
              <Button
                label="Website"
                variant="ghost"
                onPress={() => WebBrowser.openBrowserAsync(institution.website!)}
                style={{ flex: 1 }}
              />
            ) : null}
          </Row>
        </Card>

        {(jobs?.length ?? 0) > 0 ? (
          <Card>
            <Heading>Open positions</Heading>
            {jobs!.map((j) => (
              <Pressable
                key={j.id}
                accessibilityRole="button"
                accessibilityLabel={`View job ${j.title}`}
                onPress={() => router.push(`/(app)/job/${j.id}`)}
                style={{ paddingVertical: t.spacing(2) }}
              >
                <Body>{j.title}</Body>
                <Caption>
                  {[j.kind.replace('_', '-'), j.is_remote ? 'Remote' : [j.city, j.state].filter(Boolean).join(', ')]
                    .filter(Boolean)
                    .join(' · ')}
                </Caption>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {(people?.length ?? 0) > 0 ? (
          <Card style={{ paddingHorizontal: 0 }}>
            <Row style={{ paddingHorizontal: t.spacing(4) }}>
              <Heading>People</Heading>
            </Row>
            {people!.map((p, i) => (
              <PersonRow
                key={`${p.profile.id}-${i}`}
                id={p.profile.id}
                name={p.profile.full_name}
                headline={p.role_title ?? p.profile.headline}
                avatarUrl={p.profile.avatar_url}
                verificationStatus={p.profile.verification_status}
              />
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
