import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Stack } from 'expo-router';
import { useAddCme, useMyCme } from '@/api/profiles';
import { Body, Button, Caption, Card, Heading, Row, Spacer, TextField, Title } from '@/components/ui';
import { useTheme } from '@/theme';

export default function CmeScreen() {
  const t = useTheme();
  const { data: entries } = useMyCme();
  const addCme = useAddCme();

  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [hours, setHours] = useState('');
  const [completedOn, setCompletedOn] = useState('');
  const [certificateUri, setCertificateUri] = useState<string | undefined>();

  const yearTotal = (entries ?? [])
    .filter((e) => new Date(e.completed_on).getFullYear() === new Date().getFullYear())
    .reduce((sum, e) => sum + Number(e.hours), 0);

  const pickCertificate = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
    if (!result.canceled && result.assets[0]) setCertificateUri(result.assets[0].uri);
  };

  const submit = () => {
    const parsedHours = parseFloat(hours);
    if (!title.trim() || !parsedHours || !/^\d{4}-\d{2}-\d{2}$/.test(completedOn)) {
      Alert.alert('Missing details', 'Title, hours, and completion date (YYYY-MM-DD) are required.');
      return;
    }
    addCme.mutate(
      { title: title.trim(), provider: provider.trim() || undefined, hours: parsedHours, completed_on: completedOn, certificateUri },
      {
        onSuccess: () => {
          setTitle(''); setProvider(''); setHours(''); setCompletedOn(''); setCertificateUri(undefined);
        },
        onError: (e) => Alert.alert('Could not save', e.message),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'CME tracking' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(3), gap: t.spacing(3) }}>
        <Card>
          <Title>{yearTotal} hours</Title>
          <Caption>self-reported CME in {new Date().getFullYear()}</Caption>
        </Card>

        <Card style={{ gap: t.spacing(2) }}>
          <Heading>Log CME activity</Heading>
          <TextField label="Activity title" value={title} onChangeText={setTitle} placeholder="ACC Annual Congress 2026" />
          <TextField label="Provider (optional)" value={provider} onChangeText={setProvider} />
          <Row gap={2}>
            <View style={{ flex: 1 }}>
              <TextField label="Hours" keyboardType="decimal-pad" value={hours} onChangeText={setHours} />
            </View>
            <View style={{ flex: 2 }}>
              <TextField label="Completed (YYYY-MM-DD)" value={completedOn} onChangeText={setCompletedOn} placeholder="2026-07-01" />
            </View>
          </Row>
          <Button
            label={certificateUri ? 'Certificate attached ✓' : 'Attach certificate (optional)'}
            variant="ghost"
            onPress={pickCertificate}
          />
          <Button label="Add entry" onPress={submit} loading={addCme.isPending} />
        </Card>

        {(entries ?? []).map((e) => (
          <Card key={e.id}>
            <Body>{e.title}</Body>
            <Caption>
              {[`${e.hours} h`, e.provider, e.completed_on, e.certificate_path ? '📎 certificate' : null]
                .filter(Boolean)
                .join(' · ')}
            </Caption>
          </Card>
        ))}
        <Spacer size={4} />
        <Caption>CME entries are private to you. Certificates are stored in your private verification bucket.</Caption>
      </ScrollView>
    </>
  );
}
