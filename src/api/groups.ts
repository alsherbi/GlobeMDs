import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Group, GroupEvent, GroupMember, GroupPrivacy, Profile } from '@/types/database';

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('groups').select('*').order('name');
      if (error) throw error;
      return data as Group[];
    },
  });
}

export function useMyGroups() {
  return useQuery({
    queryKey: ['groups', 'mine'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('group_members')
        .select('status, role, group:groups(*)')
        .eq('profile_id', userData.user!.id);
      if (error) throw error;
      return (data as unknown as Array<{ status: string; role: string; group: Group }>).filter((r) => r.group);
    },
  });
}

export function useGroup(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase.from('groups').select('*').eq('id', groupId!).single();
      if (error) throw error;
      return data as Group;
    },
  });
}

export interface GroupMembership {
  member: GroupMember | null;
  isAdmin: boolean;
  isApproved: boolean;
}

export function useGroupMembership(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-membership', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<GroupMembership> => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId!)
        .eq('profile_id', userData.user!.id)
        .maybeSingle();
      if (error) throw error;
      const member = data as GroupMember | null;
      return {
        member,
        isAdmin: member?.role === 'admin' && member.status === 'approved',
        isApproved: member?.status === 'approved',
      };
    },
  });
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-members', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('*, profile:profiles(id, full_name, headline, avatar_url, verification_status)')
        .eq('group_id', groupId!);
      if (error) throw error;
      return data as unknown as Array<
        GroupMember & { profile: Pick<Profile, 'id' | 'full_name' | 'headline' | 'avatar_url' | 'verification_status'> }
      >;
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description: string; privacy: GroupPrivacy; specialty?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user!.id;
      const { data, error } = await supabase
        .from('groups')
        .insert({ ...input, created_by: me })
        .select()
        .single();
      if (error) throw error;
      // Creator becomes admin. Allowed by the "join public group" policy for
      // public groups; for private/invite-only groups the web app's flow uses
      // a service-role hook — reconcile with the live schema if this insert
      // is rejected there.
      await supabase.from('group_members').insert({
        group_id: (data as Group).id,
        profile_id: me,
        role: 'admin',
        status: 'approved',
      });
      return data as Group;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (group: Group) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('group_members').insert({
        group_id: group.id,
        profile_id: userData.user!.id,
        role: 'member',
        status: group.privacy === 'public' ? 'approved' : 'pending',
      });
      if (error) throw error;
    },
    onSuccess: (_d, g) => {
      queryClient.invalidateQueries({ queryKey: ['group-membership', g.id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('profile_id', userData.user!.id);
      if (error) throw error;
    },
    onSuccess: (_d, groupId) => {
      queryClient.invalidateQueries({ queryKey: ['group-membership', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

// ---------- Admin tools ----------
export function useApproveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; profileId: string }) => {
      const { error } = await supabase
        .from('group_members')
        .update({ status: 'approved' })
        .eq('group_id', input.groupId)
        .eq('profile_id', input.profileId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['group-members', v.groupId] }),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; profileId: string }) => {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', input.groupId)
        .eq('profile_id', input.profileId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['group-members', v.groupId] }),
  });
}

export function useTogglePinPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; pinned: boolean }) => {
      const { error } = await supabase
        .from('posts')
        .update({ pinned_at: input.pinned ? null : new Date().toISOString() })
        .eq('id', input.postId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-posts'] }),
  });
}

export function useRemoveGroupPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['group-posts'] }),
  });
}

export function useGroupEvents(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-events', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_events')
        .select('*')
        .eq('group_id', groupId!)
        .gte('starts_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
        .order('starts_at');
      if (error) throw error;
      return data as GroupEvent[];
    },
  });
}
