import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Institution, Job, JobApplication, JobKind } from '@/types/database';

export interface JobFilters {
  kind?: JobKind;
  specialty?: string;
  state?: string;
  remoteOnly?: boolean;
  search?: string;
}

export function useJobs(filters: JobFilters) {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select('*, institution:institutions(id, name, logo_url, city, state)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);
      if (filters.kind) query = query.eq('kind', filters.kind);
      if (filters.specialty) query = query.ilike('specialty', `%${filters.specialty}%`);
      if (filters.state) query = query.eq('state', filters.state);
      if (filters.remoteOnly) query = query.eq('is_remote', true);
      if (filters.search) query = query.ilike('title', `%${filters.search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Array<Job & { institution: Pick<Institution, 'id' | 'name' | 'logo_url' | 'city' | 'state'> | null }>;
    },
  });
}

export function useJob(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, institution:institutions(id, name, logo_url, city, state, website)')
        .eq('id', jobId!)
        .single();
      if (error) throw error;
      return data as unknown as Job & {
        institution: Pick<Institution, 'id' | 'name' | 'logo_url' | 'city' | 'state' | 'website'> | null;
      };
    },
  });
}

export function useMyApplications() {
  return useQuery({
    queryKey: ['job-applications'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('job_applications')
        .select('*, job:jobs(id, title, kind)')
        .eq('applicant_id', userData.user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Array<JobApplication & { job: Pick<Job, 'id' | 'title' | 'kind'> }>;
    },
  });
}

export function useApplyToJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: string; coverNote: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('job_applications').insert({
        job_id: input.jobId,
        applicant_id: userData.user!.id,
        cover_note: input.coverNote,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-applications'] }),
  });
}

export function usePostJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      kind: JobKind;
      specialty?: string;
      description: string;
      city?: string;
      state?: string;
      isRemote: boolean;
      compensation?: string;
      institutionId?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('jobs').insert({
        posted_by: userData.user!.id,
        title: input.title,
        kind: input.kind,
        specialty: input.specialty ?? null,
        description: input.description,
        city: input.city ?? null,
        state: input.state ?? null,
        is_remote: input.isRemote,
        compensation: input.compensation ?? null,
        institution_id: input.institutionId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });
}
