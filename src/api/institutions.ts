import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Institution, Job, Profile } from '@/types/database';

export function useInstitution(institutionId: string | undefined) {
  return useQuery({
    queryKey: ['institution', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase.from('institutions').select('*').eq('id', institutionId!).single();
      if (error) throw error;
      return data as Institution;
    },
  });
}

export function useInstitutionJobs(institutionId: string | undefined) {
  return useQuery({
    queryKey: ['institution-jobs', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('institution_id', institutionId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Job[];
    },
  });
}

export function useInstitutionPeople(institutionId: string | undefined) {
  return useQuery({
    queryKey: ['institution-people', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_institutions')
        .select('role_title, is_current, profile:profiles(id, full_name, headline, avatar_url, verification_status)')
        .eq('institution_id', institutionId!)
        .eq('is_current', true)
        .limit(50);
      if (error) throw error;
      return data as unknown as Array<{
        role_title: string | null;
        is_current: boolean;
        profile: Pick<Profile, 'id' | 'full_name' | 'headline' | 'avatar_url' | 'verification_status'>;
      }>;
    },
  });
}

export function useInstitutionFollow(institutionId: string | undefined) {
  return useQuery({
    queryKey: ['institution-follow', institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('institution_followers')
        .select('*')
        .eq('institution_id', institutionId!)
        .eq('profile_id', userData.user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useToggleInstitutionFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { institutionId: string; following: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user!.id;
      if (input.following) {
        const { error } = await supabase
          .from('institution_followers')
          .delete()
          .eq('institution_id', input.institutionId)
          .eq('profile_id', me);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('institution_followers')
          .insert({ institution_id: input.institutionId, profile_id: me });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['institution-follow', v.institutionId] }),
  });
}

export function useSearchInstitutions(query: string) {
  return useQuery({
    queryKey: ['institutions', 'search', query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .ilike('name', `%${query}%`)
        .limit(20);
      if (error) throw error;
      return data as Institution[];
    },
  });
}

export function useAddAffiliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { institutionId: string; roleTitle?: string; isCurrent: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('profile_institutions').insert({
        profile_id: userData.user!.id,
        institution_id: input.institutionId,
        role_title: input.roleTitle ?? null,
        is_current: input.isCurrent,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile-details'] }),
  });
}
