import { useEffect } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { supabase, publicStorageUrl } from '@/lib/supabase';
import { uploadToBucket } from '@/api/storage';
import {
  CommentWithAuthor,
  LinkMeta,
  PollOption,
  Post,
  PostType,
  PostVisibility,
  PostWithAuthor,
  ReactionKind,
} from '@/types/database';

const AUTHOR_SELECT = 'author:profiles!posts_author_id_fkey(id, full_name, headline, avatar_url, specialty, verification_status)';

async function hydratePosts(posts: Post[]): Promise<PostWithAuthor[]> {
  if (posts.length === 0) return [];
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user!.id;
  const ids = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.author_id))];

  const [authors, reactions, comments, myReactions, myBookmarks] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, headline, avatar_url, specialty, verification_status')
      .in('id', authorIds),
    supabase.from('reactions').select('post_id').in('post_id', ids),
    supabase.from('comments').select('post_id').in('post_id', ids),
    supabase.from('reactions').select('post_id, kind').in('post_id', ids).eq('profile_id', me),
    supabase.from('bookmarks').select('post_id').in('post_id', ids).eq('profile_id', me),
  ]);

  const authorMap = new Map((authors.data ?? []).map((a) => [a.id, a]));
  const reactionCounts = new Map<string, number>();
  (reactions.data ?? []).forEach((r) => reactionCounts.set(r.post_id, (reactionCounts.get(r.post_id) ?? 0) + 1));
  const commentCounts = new Map<string, number>();
  (comments.data ?? []).forEach((c) => commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1));
  const myReactionMap = new Map((myReactions.data ?? []).map((r) => [r.post_id, r.kind as ReactionKind]));
  const bookmarkSet = new Set((myBookmarks.data ?? []).map((b) => b.post_id));

  return posts.map((p) => ({
    ...p,
    author: authorMap.get(p.author_id) ?? {
      id: p.author_id,
      full_name: 'Unknown',
      headline: '',
      avatar_url: null,
      specialty: null,
      verification_status: 'unverified' as const,
    },
    reaction_count: reactionCounts.get(p.id) ?? 0,
    comment_count: commentCounts.get(p.id) ?? 0,
    my_reaction: myReactionMap.get(p.id) ?? null,
    bookmarked: bookmarkSet.has(p.id),
  }));
}

export type FeedMode = 'chrono' | 'top';

export function useFeed(mode: FeedMode) {
  return useInfiniteQuery({
    queryKey: ['feed', mode],
    initialPageParam: new Date().toISOString(),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('get_feed', {
        mode,
        before: pageParam,
        page_size: 20,
      });
      if (error) throw error;
      return hydratePosts((data ?? []) as Post[]);
    },
    getNextPageParam: (lastPage) =>
      lastPage.length < 20 ? undefined : lastPage[lastPage.length - 1].created_at,
  });
}

/** Realtime: refresh the feed head when anyone we can see posts something new. */
export function useFeedRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('feed-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['feed'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

export function usePost(postId: string | undefined) {
  return useQuery({
    queryKey: ['post', postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase.from('posts').select('*').eq('id', postId!).single();
      if (error) throw error;
      const [hydrated] = await hydratePosts([data as Post]);
      return hydrated;
    },
  });
}

export function useAuthorPosts(authorId: string | undefined) {
  return useQuery({
    queryKey: ['author-posts', authorId],
    enabled: !!authorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('author_id', authorId!)
        .is('group_id', null)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return hydratePosts((data ?? []) as Post[]);
    },
  });
}

export function useGroupPosts(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-posts', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('group_id', groupId!)
        .order('pinned_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return hydratePosts((data ?? []) as Post[]);
    },
  });
}

export function extractHashtags(body: string): string[] {
  return [...new Set([...body.matchAll(/#([A-Za-z][A-Za-z0-9_]{1,40})/g)].map((m) => m[1]))];
}

export interface CreatePostInput {
  type: PostType;
  body: string;
  title?: string;
  visibility: PostVisibility;
  groupId?: string;
  imageUris?: string[];
  linkUrl?: string;
  linkMeta?: LinkMeta;
  pollOptions?: PollOption[];
  /** Timestamp of the no-PHI attestation; REQUIRED for 'case' posts. */
  caseConsentAt?: string;
  reshareOf?: string;
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      if (input.type === 'case' && !input.caseConsentAt) {
        throw new Error('Case posts require the no-PHI attestation.');
      }
      const { data: userData } = await supabase.auth.getUser();
      const images: string[] = [];
      for (const uri of input.imageUris ?? []) {
        const path = await uploadToBucket('post-media', uri);
        images.push(publicStorageUrl('post-media', path));
      }
      const { error } = await supabase.from('posts').insert({
        author_id: userData.user!.id,
        group_id: input.groupId ?? null,
        type: input.type,
        visibility: input.groupId ? 'group' : input.visibility,
        body: input.body,
        title: input.title ?? null,
        images,
        link_url: input.linkUrl ?? null,
        link_meta: input.linkMeta ?? null,
        poll_options: input.pollOptions ?? null,
        case_consent_at: input.caseConsentAt ?? null,
        hashtags: extractHashtags(input.body),
        reshare_of: input.reshareOf ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['author-posts'] });
      queryClient.invalidateQueries({ queryKey: ['group-posts'] });
    },
  });
}

export function useSetReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; kind: ReactionKind | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user!.id;
      if (input.kind === null) {
        const { error } = await supabase.from('reactions').delete().eq('post_id', input.postId).eq('profile_id', me);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reactions')
          .upsert({ post_id: input.postId, profile_id: me, kind: input.kind }, { onConflict: 'post_id,profile_id' });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', v.postId] });
    },
  });
}

export function useToggleBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; bookmarked: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user!.id;
      if (input.bookmarked) {
        const { error } = await supabase.from('bookmarks').delete().eq('post_id', input.postId).eq('profile_id', me);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bookmarks').insert({ post_id: input.postId, profile_id: me });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}

export function useBookmarkedPosts() {
  return useQuery({
    queryKey: ['bookmarks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookmarks')
        .select('post:posts(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const posts = (data ?? []).map((row) => (row as unknown as { post: Post }).post).filter(Boolean);
      return hydratePosts(posts);
    },
  });
}

export function useComments(postId: string | undefined) {
  return useQuery({
    queryKey: ['comments', postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:profiles!comments_author_id_fkey(id, full_name, avatar_url, headline)')
        .eq('post_id', postId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as CommentWithAuthor[];
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; body: string; parentId?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('comments').insert({
        post_id: input.postId,
        author_id: userData.user!.id,
        body: input.body,
        parent_id: input.parentId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ['comments', v.postId] });
      queryClient.invalidateQueries({ queryKey: ['post', v.postId] });
    },
  });
}

export function usePollVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; optionId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('poll_votes').insert({
        post_id: input.postId,
        voter_id: userData.user!.id,
        option_id: input.optionId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ['poll', v.postId] }),
  });
}

export function usePollResults(postId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['poll', postId],
    enabled: !!postId && enabled,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('poll_votes').select('option_id, voter_id').eq('post_id', postId!);
      if (error) throw error;
      const counts = new Map<string, number>();
      let myVote: string | null = null;
      (data ?? []).forEach((v) => {
        counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1);
        if (v.voter_id === userData.user!.id) myVote = v.option_id;
      });
      return { counts, total: data?.length ?? 0, myVote: myVote as string | null };
    },
  });
}
