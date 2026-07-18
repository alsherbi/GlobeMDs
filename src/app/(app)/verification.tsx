import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Stack } from 'expo-router';
import { useSession } from '@/providers/SessionProvider';
import {
  useMyVerificationDocuments,
  useUploadVerificationDocument,
  useVerifyNpi,
  NpiRegistryMatch,
} from '@/api/verification';
import { Body, Button, Caption, Card, Heading, Pill, Row, Spacer, TextField, Title } from '@/components/ui';
import { useTheme } from '@/theme';
import { VerificationDocKind } from '@/types/database';

const DOC_KINDS: Array<{ kind: VerificationDocKind; label: string }> = [
  { kind: 'medical_license', label: 'Medical license' },
  { kind: 'board_certification', label: 'Board certification' },
  { kind: 'ecfmg_certificate', label: 'ECFMG certificate' },
];

export default function VerificationScreen() {
  const t = useTheme();
  const { profile } = useSession();
  const [npi, setNpi] = useState(profile?.npi_number ?? '');
  const [lastName, setLastName] = useState('');
  const [registryMatch, setRegistryMatch] = useState<NpiRegistryMatch | null>(null);
  const [docKind, setDocKind] = useState<VerificationDocKind>('medical_license');

  const verifyNpi = useVerifyNpi();
  const uploadDoc = useUploadVerificationDocument();
  const { data: docs } = useMyVerificationDocuments();

  const onVerifyNpi = () => {
    verifyNpi.mutate(
      { npi: npi.trim(), lastName: lastName.trim() },
      {
        onSuccess: (match) => setRegistryMatch(match),
        onError: (e) => Alert.alert('NPI validation failed', e.message),
      },
    );
  };

  const onPickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    uploadDoc.mutate(
      { localUri: result.assets[0].uri, kind: docKind },
      {
        onSuccess: () =>
          Alert.alert('Uploaded', 'Your document was submitted to the review queue. You will be notified once approved.'),
        onError: (e) => Alert.alert('Upload failed', e.message),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Credential verification' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), gap: t.spacing(4) }}>
        <Title>Verify your credentials</Title>
        <Body muted>
          GlobeMDs is physician-only. Verification has two steps: NPI Registry validation, then a licensed-credential
          document review by our team. Your web and mobile accounts share the same verification status.
        </Body>

        <Card>
          <Heading>Step 1 — NPI number</Heading>
          <Spacer size={2} />
          {profile?.npi_verified_at ? (
            <Body>✓ NPI {profile.npi_number} validated against the NPPES registry.</Body>
          ) : (
            <View style={{ gap: t.spacing(3) }}>
              <TextField
                label="NPI number (10 digits)"
                keyboardType="number-pad"
                maxLength={10}
                value={npi}
                onChangeText={setNpi}
                placeholder="1234567890"
              />
              <TextField
                label="Last name (as registered with NPPES)"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Smith"
              />
              <Button
                label="Validate against NPI Registry"
                onPress={onVerifyNpi}
                loading={verifyNpi.isPending}
                disabled={!/^\d{10}$/.test(npi.trim()) || !lastName.trim()}
              />
              {registryMatch ? (
                <Caption>
                  Registry match: {registryMatch.name}
                  {registryMatch.credential ? `, ${registryMatch.credential}` : ''}
                  {registryMatch.taxonomy ? ` — ${registryMatch.taxonomy}` : ''}
                </Caption>
              ) : null}
            </View>
          )}
        </Card>

        <Card>
          <Heading>Step 2 — License / certification document</Heading>
          <Spacer size={2} />
          <Body muted>
            Upload a PDF or photo of your medical license or board certification. Files go to a private, access-controlled
            bucket and are only visible to you and the review team.
          </Body>
          <Spacer size={3} />
          <Row gap={2} style={{ flexWrap: 'wrap' }}>
            {DOC_KINDS.map((d) => (
              <Pill key={d.kind} label={d.label} active={docKind === d.kind} onPress={() => setDocKind(d.kind)} />
            ))}
          </Row>
          <Spacer size={3} />
          <Button label="Choose document…" onPress={onPickDocument} loading={uploadDoc.isPending} />
          <Spacer size={3} />
          {docs?.map((d) => (
            <Row key={d.id} gap={2} style={{ paddingVertical: t.spacing(1) }}>
              <Body>
                {DOC_KINDS.find((k) => k.kind === d.kind)?.label ?? d.kind} —{' '}
                {d.status === 'submitted' ? 'awaiting review' : d.status}
              </Body>
            </Row>
          ))}
        </Card>

        <Caption>
          Status: {profile?.verification_status.replace('_', ' ')}. Approval flips the shared verified flag read by both
          the web app and this app.
        </Caption>
      </ScrollView>
    </>
  );
}
