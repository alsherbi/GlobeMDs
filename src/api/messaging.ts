import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { uploadToBucket } from '@/api/storage';
import { Conversation, Message, Profile } from '@/types/database';

type ProfileCard = Pick<Profile, 'id' | 'full_name' | 'headline' | 'avatar_url' | 'verification_status'>;

export interface ConversationListItem extends Conversation {
  participants: Array<{ profile: ProfileCard; last_read_at: string }>;
  lastMessage: Message | null;
  unread: boolean;
}

export function useConversations(requestsInbox: boolean) {
  return useQuery({
    queryKey: ['conversations', requestsInbox ? 'requests' : 'inbox'],
    queryFn: async (): Promise<ConversationListItem[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user!.id;
      const { data, error } = await supabase
        .from('conversations')
        .select(
          `*,
           participants:conversation_participants(last_read_at, profile:profiles(id, full_name, headline, avatar_url, verification_status))`,
        )
        .eq('is_request', requestsInbox)
        .order('last_message_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const conversations = data as unknown as Array<
        Conversation & { participants: Array<{ last_read_at: string; profile: ProfileCard }> }
      >;

      // Requests inbox only shows conversations someone else started with me.
      const filtered = requestsInbox ? conversations.filter((c) => c.created_by !== me) : conversations;

      const withMessages = await Promise.all(
        filtered.map(async (c) => {
          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', c.id)
            .order('created_at', { ascending: false })
            .limit(1);
          const lastMessage = (msgs?.[0] as Message | undefined) ?? null;
          const mine = c.participants.find((p) => p.profile.id === me);
          const unread =
            !!lastMessage && !!mine && lastMessage.sender_id !== me && lastMessage.created_at > mine.last_read_at;
          return { ...c, lastMessage, unread };
        }),
      );
      return withMessages;
    },
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data as Message[];
    },
  });
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(
          `*,
           participants:conversation_participants(last_read_at, profile:profiles(id, full_name, headline, avatar_url, verification_status))`,
        )
        .eq('id', conversationId!)
        .single();
      if (error) throw error;
      return data as unknown as Conversation & {
        participants: Array<{ last_read_at: string; profile: ProfileCard }>;
      };
    },
  });
}

/** Realtime messages + typing indicator over a broadcast channel. */
export function useConversationRealtime(
  conversationId: string | undefined,
  onTyping: (profileId: string) => void,
) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        const typerId = (payload.payload as { profileId?: string })?.profileId;
        if (typerId) onTyping(typerId);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // onTyping intentionally excluded: latest closure not needed for cleanup identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, queryClient]);
}

export async function broadcastTyping(conversationId: string) {
  const { data: userData } = await supabase.auth.getUser();
  await supabase.channel(`conversation-${conversationId}`).send({
    type: 'broadcast',
    event: 'typing',
    payload: { profileId: userData.user?.id },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      body: string;
      attachmentUri?: string;
      attachmentType?: 'image' | 'pdf';
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      let attachment_path: string | null = null;
      if (input.attachmentUri) {
        attachment_path = await uploadToBucket('message-attachments', input.attachmentUri, {
          fallbackExt: input.attachmentType === 'pdf' ? 'pdf' : 'jpg',
        });
      }
      const { error } = await supabase.from('messages').insert({
        conversation_id: input.conversationId,
        sender_id: userData.user!.id,
        body: input.body,
        attachment_path,
        attachment_type: input.attachmentType ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['messages', v.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('profile_id', userData.user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useStartDirectConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targetId: string) => {
      const { data, error } = await supabase.rpc('start_direct_conversation', { target: targetId });
      if (error) throw error;
      return data as string; // conversation id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useStartGroupConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; memberIds: string[] }) => {
      const { data, error } = await supabase.rpc('start_group_conversation', {
        title: input.title,
        member_ids: input.memberIds,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useAcceptMessageRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase.rpc('accept_message_request', { cid: conversationId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });
}
