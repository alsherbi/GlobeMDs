import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, publicStorageUrl } from '@/lib/supabase';
import { uploadToBucket } from '@/api/storage';
import {
  BoardCertification,
  CmeEntry,
  EducationEntry,
  License,
  Profile,
  ProfileInstitution,
  Publication,
} from '@/types/database';

export function useProfile(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profile', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', profileId!).single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export interface ProfileDetails {
  licenses: License[];
  boardCertifications: BoardCertification[];
  education: EducationEntry[];
  publications: Publication[];
  affiliations: Array<ProfileInstitution & { institution: { id: string; name: string; logo_url: string | null } }>;
}

export function useProfileDetails(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profile-details', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<ProfileDetails> => {
      const [licenses, certs, education, pubs, affiliations] = await Promise.all([
        supabase.from('licenses').select('*').eq('profile_id', profileId!),
        supabase.from('board_certifications').select('*').eq('profile_id', profileId!),
        supabase.from('education_entries').select('*').eq('profile_id', profileId!).order('start_year', { ascending: false }),
        supabase.from('publications').select('*').eq('profile_id', profileId!).order('year', { ascending: false }),
        supabase
          .from('profile_institutions')
          .select('*, institution:institutions(id, name, logo_url)')
          .eq('profile_id', profileId!),
      ]);
      const firstError = licenses.error ?? certs.error ?? education.error ?? pubs.error ?? affiliations.error;
      if (firstError) throw firstError;
      return {
        licenses: (licenses.data ?? []) as License[],
        boardCertifications: (certs.data ?? []) as BoardCertification[],
        education: (education.data ?? []) as EducationEntry[],
        publications: (pubs.data ?? []) as Publication[],
        affiliations: (affiliations.data ?? []) as ProfileDetails['affiliations'],
      };
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('profiles').update(patch).eq('id', userData.user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export function useUploadAvatar() {
  const update = useUpdateProfile();
  return useMutation({
    mutationFn: async (localUri: string) => {
      const path = await uploadToBucket('avatars', localUri);
      await update.mutateAsync({ avatar_url: publicStorageUrl('avatars', path) });
    },
  });
}

/** Profile completeness meter: fraction of high-signal fields filled in. */
export function profileCompleteness(profile: Profile | null, details?: ProfileDetails): number {
  if (!profile) return 0;
  const checks = [
    !!profile.full_name,
    !!profile.headline,
    !!profile.bio,
    !!profile.avatar_url,
    !!profile.specialty,
    !!profile.npi_number,
    profile.languages.length > 0,
    (details?.licenses.length ?? 0) > 0,
    (details?.education.length ?? 0) > 0,
    (details?.affiliations.length ?? 0) > 0,
  ];
  return checks.filter(Boolean).length / checks.length;
}

// ---------- CME (private to owner) ----------
export function useMyCme() {
  return useQuery({
    queryKey: ['cme'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cme_entries').select('*').order('completed_on', { ascending: false });
      if (error) throw error;
      return data as CmeEntry[];
    },
  });
}

export function useAddCme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; provider?: string; hours: number; completed_on: string; certificateUri?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      let certificate_path: string | null = null;
      if (input.certificateUri) {
        certificate_path = await uploadToBucket('verification-docs', input.certificateUri, { fallbackExt: 'pdf' });
      }
      const { error } = await supabase.from('cme_entries').insert({
        profile_id: userData.user!.id,
        title: input.title,
        provider: input.provider ?? null,
        hours: input.hours,
        completed_on: input.completed_on,
        certificate_path,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cme'] }),
  });
}

// Credential sub-resource editing (licenses, certs, education, publications)
type CredentialTable = 'licenses' | 'board_certifications' | 'education_entries' | 'publications';

export function useAddCredential(table: CredentialTable) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from(table).insert({ ...row, profile_id: userData.user!.id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile-details'] }),
  });
}

export function useDeleteCredential(table: CredentialTable) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile-details'] }),
  });
}

export function useRecordProfileView() {
  return useMutation({
    mutationFn: async (targetId: string) => {
      await supabase.rpc('record_profile_view', { target: targetId });
    },
  });
}
