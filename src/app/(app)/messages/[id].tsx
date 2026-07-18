import React, { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  broadcastTyping,
  useAcceptMessageRequest,
  useConversation,
  useConversationRealtime,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
} from '@/api/messaging';
import { signedStorageUrl } from '@/lib/supabase';
import { useSession } from '@/providers/SessionProvider';
import { Body, Button, Caption, Card, Row, TextField } from '@/components/ui';
import { useTheme } from '@/theme';
import { Message } from '@/types/database';

function AttachmentView({ message }: { message: Message }) {
  const t = useTheme();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (message.attachment_path) {
      signedStorageUrl('message-attachments', message.attachment_path).then(setUrl);
    }
  }, [message.attachment_path]);
  if (!message.attachment_path) return null;
  if (message.attachment_type === 'image' && url) {
    return (
      <Image
        source={{ uri: url }}
        accessibilityLabel="Image attachment"
        style={{ width: 200, height: 150, borderRadius: t.radius.sm }}
        contentFit="cover"
      />
    );
  }
  return <Caption>📎 {message.attachment_type === 'pdf' ? 'PDF attachment' : 'Attachment'}</Caption>;
}

export default function ConversationScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const me = session?.user.id;

  const { data: conversation } = useConversation(id);
  const { data: messages } = useMessages(id);
  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();
  const acceptRequest = useAcceptMessageRequest();

  const [draft, setDraft] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const listRef = useRef<FlatList<Message>>(null);

  useConversationRealtime(id, (profileId) => {
    if (profileId === me) return;
    setTypingUser(profileId);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setTypingUser(null), 3000);
  });

  // Read receipt: advance my cursor whenever the thread is open with messages.
  useEffect(() => {
    if (id && (messages?.length ?? 0) > 0) markRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, messages?.length]);

  const others = conversation?.participants.filter((p) => p.profile.id !== me) ?? [];
  const title = conversation?.is_group
    ? conversation.title ?? 'Group chat'
    : others[0]?.profile.full_name ?? 'Conversation';
  const isPendingRequest = !!conversation?.is_request && conversation.created_by !== me;
  const typerName =
    typingUser ? others.find((o) => o.profile.id === typingUser)?.profile.full_name?.split(' ')[0] : null;

  const onChangeDraft = (text: string) => {
    setDraft(text);
    if (id && Date.now() - lastTypingSent.current > 2000) {
      lastTypingSent.current = Date.now();
      broadcastTyping(id);
    }
  };

  const send = (attachment?: { uri: string; type: 'image' | 'pdf' }) => {
    if (!id || (!draft.trim() && !attachment)) return;
    sendMessage.mutate(
      {
        conversationId: id,
        body: draft.trim(),
        attachmentUri: attachment?.uri,
        attachmentType: attachment?.type,
      },
      { onError: (e) => Alert.alert('Send failed', e.message) },
    );
    setDraft('');
  };

  const attachImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) send({ uri: result.assets[0].uri, type: 'image' });
  };

  const attachPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) send({ uri: result.assets[0].uri, type: 'pdf' });
  };

  // Read receipt display: last message I sent is "seen" if every other
  // participant's cursor is past its timestamp.
  const lastMineIndex = [...(messages ?? [])].reverse().findIndex((m) => m.sender_id === me);
  const lastMine = lastMineIndex >= 0 ? (messages ?? [])[(messages?.length ?? 0) - 1 - lastMineIndex] : null;
  const seen =
    !!lastMine && others.length > 0 && others.every((o) => o.last_read_at >= lastMine.created_at);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {isPendingRequest ? (
          <Card style={{ margin: t.spacing(3) }}>
            <Body>Message request from outside your network.</Body>
            <Row gap={2} style={{ marginTop: t.spacing(2) }}>
              <Button label="Accept" onPress={() => acceptRequest.mutate(id!)} style={{ flex: 1 }} />
            </Row>
          </Card>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages ?? []}
          keyExtractor={(m) => m.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.sender_id === me;
            const sender = conversation?.participants.find((p) => p.profile.id === item.sender_id);
            return (
              <View
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  marginHorizontal: t.spacing(3),
                  marginVertical: t.spacing(1),
                }}
              >
                {conversation?.is_group && !mine ? (
                  <Caption>{sender?.profile.full_name.split(' ')[0]}</Caption>
                ) : null}
                <View
                  style={{
                    backgroundColor: mine ? t.colors.primary : t.colors.surface,
                    borderRadius: t.radius.md,
                    padding: t.spacing(2.5),
                    borderWidth: mine ? 0 : 1,
                    borderColor: t.colors.border,
                    gap: t.spacing(1),
                  }}
                >
                  <AttachmentView message={item} />
                  {item.body ? (
                    <Text style={[t.type.body, { color: mine ? t.colors.primaryText : t.colors.text }]}>
                      {item.body}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
          contentContainerStyle={{ paddingVertical: t.spacing(3) }}
        />

        <View style={{ paddingHorizontal: t.spacing(4), minHeight: 18 }}>
          {typerName ? <Caption>{typerName} is typing…</Caption> : seen ? <Caption>Seen</Caption> : null}
        </View>

        <Row gap={2} style={{ padding: t.spacing(3), borderTopWidth: 1, borderTopColor: t.colors.border }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Attach image" onPress={attachImage}>
            <Ionicons name="image-outline" size={24} color={t.colors.textMuted} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Attach PDF" onPress={attachPdf}>
            <Ionicons name="document-attach-outline" size={24} color={t.colors.textMuted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <TextField placeholder="Message…" value={draft} onChangeText={onChangeDraft} multiline />
          </View>
          <Button label="Send" onPress={() => send()} loading={sendMessage.isPending} disabled={!draft.trim()} />
        </Row>
      </KeyboardAvoidingView>
    </>
  );
}
