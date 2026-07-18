import React, { useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { usePostJob } from '@/api/jobs';
import { useSearchInstitutions } from '@/api/institutions';
import { useSession } from '@/providers/SessionProvider';
import { Body, Button, Caption, Heading, Pill, Row, TextField } from '@/components/ui';
import { useTheme } from '@/theme';
import { JobKind } from '@/types/database';

const KINDS: Array<{ kind: JobKind; label: string }> = [
  { kind: 'locum', label: 'Locum tenens' },
  { kind: 'telemedicine', label: 'Telemedicine' },
  { kind: 'full_time', label: 'Full-time' },
  { kind: 'consulting', label: 'Consulting' },
];

export default function PostJobScreen() {
  const t = useTheme();
  const router = useRouter();
  const { profile } = useSession();
  const postJob = usePostJob();

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<JobKind>('full_time');
  const [specialty, setSpecialty] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [compensation, setCompensation] = useState('');
  const [institutionQuery, setInstitutionQuery] = useState('');
  const [institutionId, setInstitutionId] = useState<string | undefined>();
  const institutions = useSearchInstitutions(institutionQuery);

  if (!profile?.is_recruiter) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Post a job' }} />
        <View style={{ flex: 1, justifyContent: 'center', padding: t.spacing(6), gap: t.spacing(2) }}>
          <Heading>Recruiter account required</Heading>
          <Body muted>
            Posting jobs requires a recruiter or institution-admin account. Contact GlobeMDs support from the web app to
            upgrade your account.
          </Body>
        </View>
      </>
    );
  }

  const submit = () => {
    postJob.mutate(
      {
        title: title.trim(),
        kind,
        specialty: specialty.trim() || undefined,
        description: description.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        isRemote,
        compensation: compensation.trim() || undefined,
        institutionId,
      },
      {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert('Could not post job', e.message),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Post a job' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), gap: t.spacing(3) }} keyboardShouldPersistTaps="handled">
        <TextField label="Job title" value={title} onChangeText={setTitle} placeholder="Telemedicine Internist — nights" />
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {KINDS.map((k) => (
            <Pill key={k.kind} label={k.label} active={kind === k.kind} onPress={() => setKind(k.kind)} />
          ))}
        </Row>
        <TextField label="Specialty" value={specialty} onChangeText={setSpecialty} />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <Body>Remote position</Body>
          <Switch value={isRemote} onValueChange={setIsRemote} />
        </Row>
        {!isRemote ? (
          <Row gap={2}>
            <TextField label="City" value={city} onChangeText={setCity} style={{ flex: 1 }} />
            <TextField label="State" autoCapitalize="characters" maxLength={2} value={state} onChangeText={setState} />
          </Row>
        ) : null}
        <TextField label="Compensation (optional)" value={compensation} onChangeText={setCompensation} placeholder="$220–260/hr" />

        <TextField
          label="Institution (search, optional)"
          value={institutionQuery}
          onChangeText={(v) => {
            setInstitutionQuery(v);
            setInstitutionId(undefined);
          }}
        />
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {(institutions.data ?? []).map((i) => (
            <Pill
              key={i.id}
              label={i.name}
              active={institutionId === i.id}
              onPress={() => setInstitutionId(institutionId === i.id ? undefined : i.id)}
            />
          ))}
        </Row>

        <Button label="Post job" onPress={submit} loading={postJob.isPending} disabled={!title.trim() || !description.trim()} />
        <Caption>Applicants apply with their verified GlobeMDs profile; you'll see applications on the web dashboard too.</Caption>
      </ScrollView>
    </>
  );
}
