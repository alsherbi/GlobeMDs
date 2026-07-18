import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useGlobalSearch, usePeopleSearch, PeopleFilters } from '@/api/search';
import { useHasPremium } from '@/api/premium';
import { PersonRow } from '@/components/PersonRow';
import { Body, Caption, Card, EmptyState, Heading, Pill, Row, Spacer, TextField } from '@/components/ui';
import { useTheme } from '@/theme';

export default function SearchScreen() {
  const t = useTheme();
  const router = useRouter();
  const hasPremium = useHasPremium();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<PeopleFilters>({});

  const global = useGlobalSearch(query);
  const filtered = usePeopleSearch(query, filters);

  const usingFilters = Object.values(filters).some(Boolean);
  const results = global.data;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Search' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(3), gap: t.spacing(3) }} keyboardShouldPersistTaps="handled">
        <TextField
          placeholder="Search people, posts, groups, jobs…"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        <Row gap={2}>
          <Pill
            label={hasPremium ? 'Advanced filters' : 'Advanced filters ⭐'}
            active={showFilters}
            onPress={() => {
              if (!hasPremium) {
                router.push('/(app)/premium');
                return;
              }
              setShowFilters((s) => !s);
            }}
          />
        </Row>

        {showFilters && hasPremium ? (
          <Card style={{ gap: t.spacing(2) }}>
            <TextField
              label="Specialty"
              value={filters.specialty ?? ''}
              onChangeText={(v) => setFilters((f) => ({ ...f, specialty: v || undefined }))}
            />
            <TextField
              label="License state (e.g. CA)"
              autoCapitalize="characters"
              maxLength={2}
              value={filters.state ?? ''}
              onChangeText={(v) => setFilters((f) => ({ ...f, state: v || undefined }))}
            />
            <TextField
              label="Language"
              value={filters.language ?? ''}
              onChangeText={(v) => setFilters((f) => ({ ...f, language: v || undefined }))}
            />
            <Row gap={2} style={{ flexWrap: 'wrap' }}>
              {(['consulting', 'locum', 'telemedicine', 'mentorship'] as const).map((o) => (
                <Pill
                  key={o}
                  label={`Open to ${o}`}
                  active={filters.openTo === o}
                  onPress={() => setFilters((f) => ({ ...f, openTo: f.openTo === o ? undefined : o }))}
                />
              ))}
            </Row>
          </Card>
        ) : null}

        {usingFilters ? (
          <>
            <Heading>People</Heading>
            {(filtered.data ?? []).map((p) => (
              <PersonRow
                key={p.id}
                id={p.id}
                name={p.full_name}
                headline={p.headline}
                avatarUrl={p.avatar_url}
                verificationStatus={p.verification_status}
              />
            ))}
            {filtered.data?.length === 0 ? <EmptyState title="No matches" /> : null}
          </>
        ) : results ? (
          <>
            {results.people.length > 0 ? (
              <>
                <Heading>People</Heading>
                {results.people.map((p) => (
                  <PersonRow
                    key={p.id}
                    id={p.id}
                    name={p.full_name}
                    headline={p.headline}
                    avatarUrl={p.avatar_url}
                    verificationStatus={p.verification_status}
                  />
                ))}
              </>
            ) : null}

            {results.posts.length > 0 ? (
              <>
                <Heading>Posts</Heading>
                {results.posts.map((p) => (
                  <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/(app)/post/${p.id}`)}>
                    <Card>
                      {p.title ? <Body>{p.title}</Body> : null}
                      <Caption>{p.body}</Caption>
                    </Card>
                  </Pressable>
                ))}
              </>
            ) : null}

            {results.groups.length > 0 ? (
              <>
                <Heading>Groups</Heading>
                {results.groups.map((g) => (
                  <Pressable key={g.id} accessibilityRole="button" onPress={() => router.push(`/(app)/group/${g.id}`)}>
                    <Card>
                      <Body>{g.name}</Body>
                      <Caption>{g.description}</Caption>
                    </Card>
                  </Pressable>
                ))}
              </>
            ) : null}

            {results.institutions.length > 0 ? (
              <>
                <Heading>Institutions</Heading>
                {results.institutions.map((i) => (
                  <Pressable key={i.id} accessibilityRole="button" onPress={() => router.push(`/(app)/institution/${i.id}`)}>
                    <Card>
                      <Body>{i.name}</Body>
                      <Caption>{[i.kind, i.city, i.state].filter(Boolean).join(' · ')}</Caption>
                    </Card>
                  </Pressable>
                ))}
              </>
            ) : null}

            {results.jobs.length > 0 ? (
              <>
                <Heading>Jobs</Heading>
                {results.jobs.map((j) => (
                  <Pressable key={j.id} accessibilityRole="button" onPress={() => router.push(`/(app)/job/${j.id}`)}>
                    <Card>
                      <Body>{j.title}</Body>
                      <Caption>
                        {[j.kind.replace('_', '-'), j.specialty, j.is_remote ? 'Remote' : [j.city, j.state].filter(Boolean).join(', ')]
                          .filter(Boolean)
                          .join(' · ')}
                      </Caption>
                    </Card>
                  </Pressable>
                ))}
              </>
            ) : null}

            {Object.values(results).every((arr) => arr.length === 0) ? (
              <EmptyState title="No results" hint="Try a different term." />
            ) : null}
          </>
        ) : (
          <View>
            <Spacer size={4} />
            <Caption>Search across physicians, posts, groups, institutions and jobs.</Caption>
          </View>
        )}
      </ScrollView>
    </>
  );
}
