import React, { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useApplyToJob, useJob, useMyApplications } from '@/api/jobs';
import { useSession } from '@/providers/SessionProvider';
import { Body, Button, Caption, Card, Heading, Spacer, TextField, Title } from '@/components/ui';
import { useTheme } from '@/theme';
import { timeAgo } from '@/utils/time';

export default function JobDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isVerified } = useSession();
  const { data: job } = useJob(id);
  const { data: applications } = useMyApplications();
  const apply = useApplyToJob();
  const [coverNote, setCoverNote] = useState('');

  if (!job) return null;
  const alreadyApplied = applications?.some((a) => a.job_id === job.id);

  const submit = () => {
    apply.mutate(
      { jobId: job.id, coverNote: coverNote.trim() },
      {
        onSuccess: () => Alert.alert('Application sent', 'Your GlobeMDs profile was shared as your resume.'),
        onError: (e) => Alert.alert('Could not apply', e.message),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Job' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(3), gap: t.spacing(3) }}>
        <Card>
          <Title>{job.title}</Title>
          <Caption>
            {[
              job.institution?.name,
              job.kind.replace('_', '-'),
              job.is_remote ? 'Remote' : [job.city, job.state].filter(Boolean).join(', '),
              job.specialty ?? undefined,
              `posted ${timeAgo(job.created_at)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Caption>
          {job.compensation ? (
            <>
              <Spacer size={2} />
              <Body>{job.compensation}</Body>
            </>
          ) : null}
          {job.institution ? (
            <>
              <Spacer size={2} />
              <Button
                label={`View ${job.institution.name}`}
                variant="ghost"
                onPress={() => router.push(`/(app)/institution/${job.institution!.id}`)}
              />
            </>
          ) : null}
        </Card>

        <Card>
          <Heading>Description</Heading>
          <Spacer size={2} />
          <Body>{job.description}</Body>
        </Card>

        <Card>
          <Heading>Apply</Heading>
          <Spacer size={2} />
          {alreadyApplied ? (
            <Body>✓ You applied to this position. The recruiter can view your GlobeMDs profile.</Body>
          ) : (
            <>
              <Caption>Your GlobeMDs profile (credentials, experience, publications) is attached automatically.</Caption>
              <Spacer size={2} />
              <TextField
                label="Cover note (optional)"
                value={coverNote}
                onChangeText={setCoverNote}
                multiline
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
              <Spacer size={3} />
              <Button label="Apply with profile" onPress={submit} loading={apply.isPending} disabled={!isVerified} />
              {!isVerified ? <Caption>Verification required to apply.</Caption> : null}
            </>
          )}
        </Card>
      </ScrollView>
    </>
  );
}
