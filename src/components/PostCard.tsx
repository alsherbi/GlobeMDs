import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { PostWithAuthor, ReactionKind } from '@/types/database';
import { usePollResults, usePollVote, useSetReaction, useToggleBookmark } from '@/api/posts';
import { Avatar, Body, Caption, Card, Row, VerifiedBadge } from '@/components/ui';
import { useTheme } from '@/theme';
import { timeAgo } from '@/utils/time';
import { formatCitation } from '@/utils/citation';

const REACTIONS: Array<{ kind: ReactionKind; label: string; emoji: string }> = [
  { kind: 'like', label: 'Like', emoji: '👍' },
  { kind: 'insightful', label: 'Insightful', emoji: '💡' },
  { kind: 'celebrate', label: 'Celebrate', emoji: '🎉' },
  { kind: 'support', label: 'Support', emoji: '🤝' },
  { kind: 'curious', label: 'Curious', emoji: '🤔' },
];

export function PostCard({ post, detail = false }: { post: PostWithAuthor; detail?: boolean }) {
  const t = useTheme();
  const router = useRouter();
  const setReaction = useSetReaction();
  const toggleBookmark = useToggleBookmark();
  const [showReactionBar, setShowReactionBar] = useState(false);

  const isPoll = post.type === 'poll' && !!post.poll_options;
  const poll = usePollResults(post.id, isPoll);
  const pollVote = usePollVote();

  const myReaction = REACTIONS.find((r) => r.kind === post.my_reaction);

  const openBody = () => {
    if (!detail) router.push(`/(app)/post/${post.id}`);
  };

  return (
    <Card style={{ gap: t.spacing(3) }}>
      {/* header */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${post.author.full_name}'s profile`}
        onPress={() => router.push(`/(app)/profile/${post.author.id}`)}
      >
        <Row gap={3}>
          <Avatar url={post.author.avatar_url} name={post.author.full_name} size={40} />
          <View style={{ flex: 1 }}>
            <Row gap={1.5}>
              <Body>{post.author.full_name}</Body>
              <VerifiedBadge status={post.author.verification_status} />
            </Row>
            <Caption>
              {[post.author.headline, timeAgo(post.created_at)].filter(Boolean).join(' · ')}
            </Caption>
          </View>
          {post.pinned_at ? <Ionicons name="pin" size={16} color={t.colors.textMuted} /> : null}
        </Row>
      </Pressable>

      {/* case-discussion banner */}
      {post.type === 'case' ? (
        <View
          style={{
            backgroundColor: t.colors.surfaceAlt,
            borderRadius: t.radius.sm,
            padding: t.spacing(2),
          }}
        >
          <Caption>De-identified case discussion — author attested no PHI. Report if you see identifiers.</Caption>
        </View>
      ) : null}

      {/* body */}
      <Pressable accessibilityRole={detail ? undefined : 'button'} onPress={openBody}>
        {post.title ? <Body>{post.title}</Body> : null}
        <Text
          style={[t.type.body, { color: t.colors.text }]}
          numberOfLines={detail ? undefined : 8}
        >
          {post.body}
        </Text>
      </Pressable>

      {/* images */}
      {post.images.length > 0 ? (
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {post.images.map((url) => (
            <Image
              key={url}
              source={{ uri: url }}
              accessibilityLabel="Post image"
              style={{
                width: post.images.length === 1 ? '100%' : '48%',
                aspectRatio: 4 / 3,
                borderRadius: t.radius.sm,
                backgroundColor: t.colors.surfaceAlt,
              }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ))}
        </Row>
      ) : null}

      {/* link / citation */}
      {post.link_url || post.link_meta?.pmid ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open linked article"
          onPress={() => {
            const url = post.link_url ?? `https://pubmed.ncbi.nlm.nih.gov/${post.link_meta?.pmid}/`;
            WebBrowser.openBrowserAsync(url);
          }}
          style={{
            borderWidth: 1,
            borderColor: t.colors.border,
            borderRadius: t.radius.sm,
            padding: t.spacing(3),
          }}
        >
          {post.link_meta?.pmid ? (
            <>
              <Caption>📄 Journal citation</Caption>
              <Body numberOfLines={3}>{formatCitation(post.link_meta)}</Body>
            </>
          ) : (
            <>
              <Caption>{post.link_meta?.siteName ?? 'Link'}</Caption>
              <Body numberOfLines={2}>{post.link_meta?.title ?? post.link_url}</Body>
            </>
          )}
        </Pressable>
      ) : null}

      {/* poll */}
      {isPoll ? (
        <View style={{ gap: t.spacing(2) }}>
          {post.poll_options!.map((option) => {
            const votes = poll.data?.counts.get(option.id) ?? 0;
            const total = poll.data?.total ?? 0;
            const voted = !!poll.data?.myVote;
            const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={`Vote ${option.text}`}
                disabled={voted || pollVote.isPending}
                onPress={() => pollVote.mutate({ postId: post.id, optionId: option.id })}
                style={{
                  borderWidth: 1,
                  borderColor: poll.data?.myVote === option.id ? t.colors.primary : t.colors.border,
                  borderRadius: t.radius.sm,
                  padding: t.spacing(2.5),
                  overflow: 'hidden',
                }}
              >
                {voted ? (
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${pct}%`,
                      backgroundColor: t.colors.surfaceAlt,
                    }}
                  />
                ) : null}
                <Row style={{ justifyContent: 'space-between' }}>
                  <Body>{option.text}</Body>
                  {voted ? <Caption>{pct}%</Caption> : null}
                </Row>
              </Pressable>
            );
          })}
          <Caption>{poll.data?.total ?? 0} votes</Caption>
        </View>
      ) : null}

      {/* hashtags */}
      {post.hashtags.length > 0 ? (
        <Caption>{post.hashtags.map((h) => `#${h}`).join('  ')}</Caption>
      ) : null}

      {/* reaction bar */}
      {showReactionBar ? (
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {REACTIONS.map((r) => (
            <Pressable
              key={r.kind}
              accessibilityRole="button"
              accessibilityLabel={r.label}
              onPress={() => {
                setReaction.mutate({ postId: post.id, kind: r.kind });
                setShowReactionBar(false);
              }}
              style={{
                backgroundColor: t.colors.surfaceAlt,
                borderRadius: t.radius.full,
                paddingHorizontal: t.spacing(2.5),
                paddingVertical: t.spacing(1.5),
              }}
            >
              <Text style={{ fontSize: 16 }}>{r.emoji}</Text>
            </Pressable>
          ))}
        </Row>
      ) : null}

      {/* footer actions */}
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={myReaction ? `Remove ${myReaction.label} reaction` : 'React'}
          onPress={() => {
            if (post.my_reaction) {
              setReaction.mutate({ postId: post.id, kind: null });
            } else {
              setShowReactionBar((s) => !s);
            }
          }}
        >
          <Row gap={1}>
            <Text style={{ fontSize: 15 }}>{myReaction ? myReaction.emoji : '👍'}</Text>
            <Caption>{post.reaction_count > 0 ? post.reaction_count : 'React'}</Caption>
          </Row>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comments"
          onPress={() => router.push(`/(app)/post/${post.id}`)}
        >
          <Row gap={1}>
            <Ionicons name="chatbubble-outline" size={16} color={t.colors.textMuted} />
            <Caption>{post.comment_count > 0 ? post.comment_count : 'Comment'}</Caption>
          </Row>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reshare with commentary"
          onPress={() => router.push({ pathname: '/(app)/compose', params: { reshareOf: post.id } })}
        >
          <Row gap={1}>
            <Ionicons name="repeat-outline" size={17} color={t.colors.textMuted} />
            <Caption>Reshare</Caption>
          </Row>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.bookmarked ? 'Remove bookmark' : 'Save post'}
          onPress={() => toggleBookmark.mutate({ postId: post.id, bookmarked: post.bookmarked })}
        >
          <Ionicons
            name={post.bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={17}
            color={post.bookmarked ? t.colors.primary : t.colors.textMuted}
          />
        </Pressable>
      </Row>
    </Card>
  );
}
