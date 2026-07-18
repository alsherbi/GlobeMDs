import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Connection, ConnectionSuggestion, Profile } from '@/types/database';

type ProfileCard = Pick<Profile, 'id' | 'full_name' | 'headline' | 'avatar_url' | 'specialty' | 'verification_status'>;
const PROFILE_CARD = 'id, full_name, headline, avatar_url, specialty, verification_status';

/** Relationship between me and another profile, for profile-screen actions. */
export type RelationshipStatus =
  | { kind: 'none' }
  | { kind: 'connected'; connectionId: string }
  | { kind: 'outgoing_pending'; connectionId: string }
  | { kind: 'incoming_pending'; connectionId: string };

export function useRelationship(otherId: string | undefined) {
  return useQuery({
    queryKey: ['relationship', otherId],
    enabled: !!otherId,
    queryFn: async (): Promise<RelationshipStatus & { following: boolean }> => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user!.id;
      const [{ data: edges, error }, { data: follow }] = await Promise.all([
        supabase
          .from('connections')
          .select('*')
          .or(`and(requester_id.eq.${me},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${me})`),
        supabase.from('follows').select('*').eq('follower_id', me).eq('followee_id', otherId!).maybeSingle(),
      ]);
      if (error) throw error;
      const edge = (edges as Connection[] | null)?.[0];
      const following = !!follow;
      if (!edge || edge.status === 'declined') return { kind: 'none', following };
      if (edge.status === 'accepted') return { kind: 'connected', connectionId: edge.id, following };
      return edge.requester_id === me
        ? { kind: 'outgoing_pending', connectionId: edge.id, following }
        : { kind: 'incoming_pending', connectionId: edge.id, following };
    },
  });
}

export function useSendConnectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase.rpc('send_connection_request', { target: targetId });
      if (error) throw error;
    },
    onSuccess: (_d, targetId) => {
      queryClient.invalidateQueries({ queryKey: ['relationship', targetId] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}

export function useRespondConnectionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { requestId: string; accept: boolean }) => {
      const { error } = await supabase.rpc('respond_connection_request', {
        request_id: input.requestId,
        accept: input.accept,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['relationship'] });
    },
  });
}

export function useToggleFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetId: string; following: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user!.id;
      if (input.following) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', me)
          .eq('followee_id', input.targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: me, followee_id: input.targetId });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['relationship', v.targetId] }),
  });
}

export interface IncomingRequest {
  id: string;
  created_at: string;
  requester: ProfileCard;
}

export function useIncomingRequests() {
  return useQuery({
    queryKey: ['connections', 'incoming'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('connections')
        .select(`id, created_at, requester:profiles!connections_requester_id_fkey(${PROFILE_CARD})`)
        .eq('addressee_id', userData.user!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as IncomingRequest[];
    },
  });
}

export interface ConnectionListItem {
  id: string;
  responded_at: string | null;
  peer: ProfileCard;
}

export function useMyConnections() {
  return useQuery({
    queryKey: ['connections', 'accepted'],
    queryFn: async (): Promise<ConnectionListItem[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user!.id;
      const { data, error } = await supabase
        .from('connections')
        .select(
          `id, responded_at, requester_id, addressee_id,
           requester:profiles!connections_requester_id_fkey(${PROFILE_CARD}),
           addressee:profiles!connections_addressee_id_fkey(${PROFILE_CARD})`,
        )
        .eq('status', 'accepted')
        .order('responded_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Array<{
        id: string;
        responded_at: string | null;
        requester_id: string;
        requester: ProfileCard;
        addressee: ProfileCard;
      }>).map((row) => ({
        id: row.id,
        responded_at: row.responded_at,
        peer: row.requester_id === me ? row.addressee : row.requester,
      }));
    },
  });
}

export function useConnectionSuggestions() {
  return useQuery({
    queryKey: ['connections', 'suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('suggest_connections', { max_results: 20 });
      if (error) throw error;
      return data as ConnectionSuggestion[];
    },
  });
}

export function useMutualCount(otherId: string | undefined) {
  return useQuery({
    queryKey: ['mutual-count', otherId],
    enabled: !!otherId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('mutual_connection_count', { other: otherId });
      if (error) throw error;
      return data as number;
    },
  });
}
