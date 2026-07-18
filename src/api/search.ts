import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { GlobalSearchResult, Profile, ReferralEntry } from '@/types/database';

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: ['global-search', query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('global_search', { q: query.trim(), max_per_kind: 10 });
      if (error) throw error;
      return data as unknown as GlobalSearchResult;
    },
  });
}

export interface PeopleFilters {
  specialty?: string;
  language?: string;
  openTo?: string;
  state?: string;
}

/**
 * Advanced people search (premium feature — the screen gates the filter UI
 * behind an entitlement; the base name search is free).
 */
export function usePeopleSearch(query: string, filters: PeopleFilters) {
  return useQuery({
    queryKey: ['people-search', query, filters],
    enabled: query.trim().length >= 2 || Object.values(filters).some(Boolean),
    queryFn: async () => {
      let q = supabase
        .from('profiles')
        .select('id, full_name, headline, avatar_url, specialty, verification_status, languages, open_to')
        .limit(30);
      if (query.trim().length >= 2) q = q.ilike('full_name', `%${query.trim()}%`);
      if (filters.specialty) q = q.ilike('specialty', `%${filters.specialty}%`);
      if (filters.language) q = q.contains('languages', [filters.language]);
      if (filters.openTo) q = q.contains('open_to', [filters.openTo]);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data as unknown as Array<
        Pick<Profile, 'id' | 'full_name' | 'headline' | 'avatar_url' | 'specialty' | 'verification_status' | 'languages' | 'open_to'>
      >;
      if (filters.state) {
        // license-state filter joins through licenses
        const { data: licensed } = await supabase
          .from('licenses')
          .select('profile_id')
          .eq('state', filters.state);
        const allowed = new Set((licensed ?? []).map((l) => l.profile_id));
        rows = rows.filter((r) => allowed.has(r.id));
      }
      return rows;
    },
  });
}

export function useReferralDirectory(specialty: string, region: string) {
  return useQuery({
    queryKey: ['referrals', specialty, region],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_referral_directory', {
        spec: specialty || null,
        region: region || null,
        max_results: 30,
      });
      if (error) throw error;
      return data as ReferralEntry[];
    },
  });
}
