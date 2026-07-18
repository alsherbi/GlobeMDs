import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AppNotification, NotificationPrefs, Profile } from '@/types/database';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url, headline)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as Array<
        AppNotification & { actor: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'headline'> | null }
      >;
    },
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

/** Live in-app notification updates (web actions appear instantly on mobile). */
export function useNotificationsRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('my-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: NotificationPrefs) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('profiles')
        .update({ notification_prefs: prefs })
        .eq('id', userData.user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });
}
