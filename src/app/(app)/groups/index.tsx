import React, { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useCreateGroup, useGroups, useMyGroups } from '@/api/groups';
import { Body, Button, Caption, Card, Heading, Pill, Row, TextField } from '@/components/ui';
import { useSession } from '@/providers/SessionProvider';
import { useTheme } from '@/theme';
import { GroupPrivacy } from '@/types/database';

export default function GroupsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { isVerified } = useSession();
  const { data: groups } = useGroups();
  const { data: myGroups } = useMyGroups();
  const createGroup = useCreateGroup();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('public');

  const myGroupIds = new Set(myGroups?.map((g) => g.group.id));

  const submit = () => {
    createGroup.mutate(
      { name: name.trim(), description: description.trim(), privacy },
      {
        onSuccess: (g) => {
          setCreating(false);
          router.push(`/(app)/group/${g.id}`);
        },
        onError: (e) => Alert.alert('Could not create group', e.message),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Groups' }} />
      <FlatList
        data={groups ?? []}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={
          isVerified ? (
            <View style={{ padding: t.spacing(3) }}>
              <Button label="+ Create a group" variant="secondary" onPress={() => setCreating(true)} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open group ${item.name}`}
            onPress={() => router.push(`/(app)/group/${item.id}`)}
            style={{ paddingHorizontal: t.spacing(3), paddingBottom: t.spacing(3) }}
          >
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body>{item.name}</Body>
                {myGroupIds.has(item.id) ? <Caption>Member</Caption> : null}
              </Row>
              <Caption>
                {[item.privacy.replace('_', '-'), item.specialty].filter(Boolean).join(' · ')}
              </Caption>
              {item.description ? <Caption>{item.description}</Caption> : null}
            </Card>
          </Pressable>
        )}
        contentContainerStyle={{ paddingBottom: t.spacing(8) }}
      />

      <Modal visible={creating} transparent animationType="slide" onRequestClose={() => setCreating(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: t.spacing(5) }}>
          <Card style={{ gap: t.spacing(3) }}>
            <Heading>New group</Heading>
            <TextField label="Name" value={name} onChangeText={setName} placeholder="Rural Emergency Medicine" />
            <TextField label="Description" value={description} onChangeText={setDescription} multiline />
            <Row gap={2}>
              <Pill label="Public" active={privacy === 'public'} onPress={() => setPrivacy('public')} />
              <Pill label="Private" active={privacy === 'private'} onPress={() => setPrivacy('private')} />
              <Pill label="Invite-only" active={privacy === 'invite_only'} onPress={() => setPrivacy('invite_only')} />
            </Row>
            <Row gap={2}>
              <Button label="Cancel" variant="ghost" onPress={() => setCreating(false)} style={{ flex: 1 }} />
              <Button label="Create" onPress={submit} loading={createGroup.isPending} disabled={!name.trim()} style={{ flex: 1 }} />
            </Row>
          </Card>
        </View>
      </Modal>
    </>
  );
}
