import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { searchIcd10, COMMON_ICD10, Icd10Entry } from '@/utils/icd10';
import { Body, Caption, Card, Heading, TextField } from '@/components/ui';
import { useTheme } from '@/theme';

export default function Icd10Screen() {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Icd10Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const handle = setTimeout(() => {
      searchIcd10(query.trim())
        .then((r) => {
          setResults(r);
          setError(null);
        })
        .catch(() => setError('Live search unavailable — showing common codes only.'));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const list = query.trim().length >= 2 && results.length > 0 ? results : COMMON_ICD10.filter(
    (c) =>
      !query.trim() ||
      c.code.toLowerCase().includes(query.trim().toLowerCase()) ||
      c.description.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'ICD-10 reference' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(3), gap: t.spacing(2) }} keyboardShouldPersistTaps="handled">
        <Caption>
          Quick reference for tagging case discussions — not for clinical documentation or billing.
        </Caption>
        <TextField placeholder="Search code or description…" value={query} onChangeText={setQuery} autoFocus />
        {error ? <Caption>{error}</Caption> : null}
        {list.map((c) => (
          <Card key={c.code} style={{ paddingVertical: t.spacing(2.5) }}>
            <View style={{ flexDirection: 'row', gap: t.spacing(3) }}>
              <Heading>{c.code}</Heading>
              <View style={{ flex: 1 }}>
                <Body>{c.description}</Body>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </>
  );
}
