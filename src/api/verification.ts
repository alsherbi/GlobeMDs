import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { uploadToBucket } from '@/api/storage';
import { VerificationDocKind, VerificationDocument } from '@/types/database';

export interface NpiRegistryMatch {
  name: string;
  credential: string | null;
  taxonomy: string | null;
  state: string | null;
}

/** Server-side NPI Registry validation via the npi-verify edge function. */
export function useVerifyNpi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { npi: string; lastName: string }) => {
      const { data, error } = await supabase.functions.invoke('npi-verify', { body: input });
      if (error) {
        // supabase-js wraps non-2xx responses; surface the function's message
        const context = (error as { context?: Response }).context;
        if (context) {
          const body = await context.json().catch(() => null);
          throw new Error(body?.error ?? error.message);
        }
        throw new Error(error.message);
      }
      return data.registry as NpiRegistryMatch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useMyVerificationDocuments() {
  return useQuery({
    queryKey: ['verification-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verification_documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as VerificationDocument[];
    },
  });
}

export function useUploadVerificationDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { localUri: string; kind: VerificationDocKind }) => {
      const storagePath = await uploadToBucket('verification-docs', input.localUri, { fallbackExt: 'pdf' });
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('verification_documents').insert({
        profile_id: userData.user!.id,
        kind: input.kind,
        storage_path: storagePath,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-documents'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
