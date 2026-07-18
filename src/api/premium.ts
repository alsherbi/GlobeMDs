// Premium entitlements.
//
// Source of truth is public.entitlements, written by the revenuecat-webhook
// edge function. The RevenueCat purchase SDK (react-native-purchases) is a
// native module and is wired in during the EAS dev-client/production build —
// see docs/STORE_CHECKLIST.md. Until then `purchasePremium` routes users to
// the paywall explainer, and any entitlement granted on web (Stripe) or via
// RevenueCat sandbox shows up here automatically because both clients read
// the same table.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Entitlement } from '@/types/database';

export function useEntitlements() {
  return useQuery({
    queryKey: ['entitlements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('entitlements').select('*');
      if (error) throw error;
      return data as Entitlement[];
    },
  });
}

export function useHasPremium(): boolean {
  const { data } = useEntitlements();
  return !!data?.some(
    (e) => e.status === 'active' && (!e.expires_at || new Date(e.expires_at) > new Date()),
  );
}

export function useProfileViewers(enabled: boolean) {
  return useQuery({
    queryKey: ['profile-viewers'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_profile_viewers', { page_size: 30 });
      if (error) throw error;
      return data as Array<{
        viewer_id: string;
        full_name: string;
        headline: string | null;
        avatar_url: string | null;
        viewed_at: string;
      }>;
    },
  });
}
