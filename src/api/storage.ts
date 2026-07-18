// Upload helpers targeting the SAME storage buckets the web app uses.
// Paths are always namespaced by user id (RLS policies require it).

import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';

function extensionOf(uri: string, fallback: string): string {
  const match = /\.(\w{2,4})(\?|$)/.exec(uri);
  return match ? match[1].toLowerCase() : fallback;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
};

export async function uploadToBucket(
  bucket: 'avatars' | 'post-media' | 'verification-docs' | 'message-attachments',
  localUri: string,
  options?: { fallbackExt?: string },
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const ext = extensionOf(localUri, options?.fallbackExt ?? 'jpg');
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { error } = await supabase.storage.from(bucket).upload(path, decode(base64), {
    contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  return path;
}
