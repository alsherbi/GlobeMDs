import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useJobs } from '@/api/jobs';
import { useSession } from '@/providers/SessionProvider';
import { Body, Caption, Card, EmptyState, Pill, Row, TextField } from '@/components/ui';
import { useTheme } from '@/theme';
import { JobKind } from '@/types/database';
import { timeAgo } from '@/utils/time';

const KINDS: Array<{ kind: JobKind; label: string }> = [
  { kind: 'locum', label: 'Locum tenens' },
  { kind: 'telemedicine', label: 'Telemedicine' },
  { kind: 'full_time', label: 'Full-time' },
  { kind: 'consulting', label: 'Consulting' },
];

export default function JobsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { profile } = useSession();
  const [kind, setKind] = useState<JobKind | undefined>();
  const [search, setSearch] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const jobs = useJobs({ kind, search: search || undefined, remoteOnly });

  return (
    <FlatList
      data={jobs.data ?? []}
      keyExtractor={(j) => j.id}
      ListHeaderComponent={
        <View style={{ padding: t.spacing(3), gap: t.spacing(3) }}>
          <TextField placeholder="Search jobs…" value={search} onChangeText={setSearch} />
          <Row gap={2} style={{ flexWrap: 'wrap' }}>
            {KINDS.map((k) => (
              <Pill
                key={k.kind}
                label={k.label}
                active={kind === k.kind}
                onPress={() => setKind(kind === k.kind ? undefined : k.kind)}
              />
            ))}
            <Pill label="Remote" active={remoteOnly} onPress={() => setRemoteOnly((r) => !r)} />
          </Row>
          {profile?.is_recruiter ? (
            <Pill label="+ Post a job" onPress={() => router.push('/(app)/post-job')} />
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View job ${item.title}`}
          onPress={() => router.push(`/(app)/job/${item.id}`)}
          style={{ paddingHorizontal: t.spacing(3), paddingBottom: t.spacing(3) }}
        >
          <Card>
            <Body>{item.title}</Body>
            <Caption>
              {[
                item.institution?.name,
                KINDS.find((k) => k.kind === item.kind)?.label,
                item.is_remote ? 'Remote' : [item.city, item.state].filter(Boolean).join(', '),
                item.specialty ?? undefined,
                timeAgo(item.created_at),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Caption>
            {item.compensation ? <Caption>{item.compensation}</Caption> : null}
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={
        jobs.isLoading ? null : <EmptyState title="No jobs match" hint="Try removing a filter." />
      }
      refreshControl={<RefreshControl refreshing={jobs.isRefetching} onRefresh={() => jobs.refetch()} />}
      contentContainerStyle={{ paddingBottom: t.spacing(8) }}
    />
  );
}
