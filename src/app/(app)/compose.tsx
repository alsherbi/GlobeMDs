import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCreatePost } from '@/api/posts';
import { useMyGroups } from '@/api/groups';
import { useSession } from '@/providers/SessionProvider';
import { Body, Button, Caption, Card, Heading, Pill, Row, Spacer, TextField } from '@/components/ui';
import { useTheme } from '@/theme';
import { LinkMeta, PollOption, PostType, PostVisibility } from '@/types/database';
import { CASE_CONSENT_TEXT, screenForPhi, PhiFinding } from '@/utils/phi';
import { extractPmid, fetchPubMedCitation, formatCitation } from '@/utils/citation';

const POST_TYPES: Array<{ type: PostType; label: string }> = [
  { type: 'text', label: 'Update' },
  { type: 'article', label: 'Article' },
  { type: 'image', label: 'Photo' },
  { type: 'link', label: 'Link / journal' },
  { type: 'poll', label: 'Poll' },
  { type: 'case', label: 'Case discussion' },
];

export default function ComposeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { reshareOf, groupId } = useLocalSearchParams<{ reshareOf?: string; groupId?: string }>();
  const { isVerified } = useSession();
  const createPost = useCreatePost();
  const { data: myGroups } = useMyGroups();

  const [type, setType] = useState<PostType>('text');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [targetGroupId, setTargetGroupId] = useState<string | undefined>(groupId);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [linkMeta, setLinkMeta] = useState<LinkMeta | null>(null);
  const [pollOptionTexts, setPollOptionTexts] = useState<string[]>(['', '']);
  const [phiFindings, setPhiFindings] = useState<PhiFinding[]>([]);
  const [consentVisible, setConsentVisible] = useState(false);
  const [fetchingCitation, setFetchingCitation] = useState(false);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUris(result.assets.map((a) => a.uri).slice(0, 4));
    }
  };

  const attachCitation = async () => {
    const pmid = extractPmid(linkInput);
    setFetchingCitation(true);
    try {
      if (pmid) {
        setLinkMeta(await fetchPubMedCitation(pmid));
      } else if (/^https?:\/\//.test(linkInput.trim())) {
        setLinkMeta({ title: linkInput.trim() });
      } else {
        Alert.alert('Invalid link', 'Paste a URL, a PubMed link, or a PMID.');
      }
    } catch (e) {
      Alert.alert('Lookup failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setFetchingCitation(false);
    }
  };

  const doSubmit = (caseConsentAt?: string) => {
    const pollOptions: PollOption[] | undefined =
      type === 'poll'
        ? pollOptionTexts
            .map((text, i) => ({ id: `opt-${i}`, text: text.trim() }))
            .filter((o) => o.text.length > 0)
        : undefined;

    createPost.mutate(
      {
        type,
        body: body.trim(),
        title: type === 'article' ? title.trim() : undefined,
        visibility,
        groupId: targetGroupId,
        imageUris: type === 'image' ? imageUris : undefined,
        linkUrl: linkMeta?.pmid ? undefined : linkMeta?.title,
        linkMeta: linkMeta ?? undefined,
        pollOptions,
        caseConsentAt,
        reshareOf: reshareOf || undefined,
      },
      {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert('Post failed', e.message),
      },
    );
  };

  const submit = () => {
    if (!body.trim()) {
      Alert.alert('Empty post', 'Write something first.');
      return;
    }
    if (type === 'poll' && pollOptionTexts.filter((o) => o.trim()).length < 2) {
      Alert.alert('Poll needs options', 'Add at least two poll options.');
      return;
    }
    // PHI screening runs on every post; case posts additionally require consent
    const findings = screenForPhi(`${title} ${body}`);
    setPhiFindings(findings);
    if (type === 'case') {
      setConsentVisible(true);
      return;
    }
    if (findings.length > 0) {
      Alert.alert(
        'Possible identifying information',
        `Your post may contain: ${findings.map((f) => f.label.toLowerCase()).join('; ')}. GlobeMDs prohibits patient-identifiable information. Post anyway?`,
        [
          { text: 'Review post', style: 'cancel' },
          { text: 'Post', style: 'destructive', onPress: () => doSubmit() },
        ],
      );
      return;
    }
    doSubmit();
  };

  if (!isVerified) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: t.spacing(6), gap: t.spacing(3) }}>
        <Heading>Verification required</Heading>
        <Body muted>Posting unlocks once your medical credentials are verified.</Body>
        <Button label="Go to verification" onPress={() => router.push('/(app)/verification')} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: reshareOf ? 'Reshare' : 'New post' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), gap: t.spacing(3) }} keyboardShouldPersistTaps="handled">
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {POST_TYPES.map((p) => (
            <Pill key={p.type} label={p.label} active={type === p.type} onPress={() => setType(p.type)} />
          ))}
        </Row>

        {type === 'case' ? (
          <Card style={{ backgroundColor: t.colors.surfaceAlt }}>
            <Caption>
              Case discussions must be fully de-identified: no names, initials, MRNs, dates of birth, exact dates,
              facility names, or identifiable images. You will be asked to attest before posting.
            </Caption>
          </Card>
        ) : null}

        {type === 'article' ? <TextField label="Title" value={title} onChangeText={setTitle} /> : null}

        <TextField
          label={type === 'case' ? 'De-identified case (use age ranges, omit dates)' : 'Post'}
          value={body}
          onChangeText={setBody}
          multiline
          placeholder={
            type === 'case'
              ? 'e.g. 60s M with progressive dyspnea… #Cardiology'
              : "What's on your mind? Use #hashtags for topics."
          }
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />

        {type === 'image' ? (
          <View style={{ gap: t.spacing(2) }}>
            <Button label={imageUris.length ? `${imageUris.length} image(s) selected` : 'Add images'} variant="secondary" onPress={pickImages} />
            <Row gap={2} style={{ flexWrap: 'wrap' }}>
              {imageUris.map((uri) => (
                <Image key={uri} source={{ uri }} style={{ width: 72, height: 72, borderRadius: t.radius.sm }} />
              ))}
            </Row>
          </View>
        ) : null}

        {type === 'link' ? (
          <View style={{ gap: t.spacing(2) }}>
            <TextField
              label="URL, PubMed link, or PMID"
              autoCapitalize="none"
              value={linkInput}
              onChangeText={setLinkInput}
              placeholder="https://pubmed.ncbi.nlm.nih.gov/12345678/"
            />
            <Button label="Attach" variant="secondary" onPress={attachCitation} loading={fetchingCitation} />
            {linkMeta?.pmid ? <Caption>📄 {formatCitation(linkMeta)}</Caption> : linkMeta ? <Caption>🔗 {linkMeta.title}</Caption> : null}
          </View>
        ) : null}

        {type === 'poll' ? (
          <View style={{ gap: t.spacing(2) }}>
            {pollOptionTexts.map((opt, i) => (
              <TextField
                key={i}
                label={`Option ${i + 1}`}
                value={opt}
                onChangeText={(v) => setPollOptionTexts((prev) => prev.map((p, j) => (j === i ? v : p)))}
              />
            ))}
            {pollOptionTexts.length < 5 ? (
              <Button label="+ Add option" variant="ghost" onPress={() => setPollOptionTexts((p) => [...p, ''])} />
            ) : null}
          </View>
        ) : null}

        {!targetGroupId ? (
          <Row gap={2}>
            <Pill label="Public" active={visibility === 'public'} onPress={() => setVisibility('public')} />
            <Pill label="Connections only" active={visibility === 'connections'} onPress={() => setVisibility('connections')} />
          </Row>
        ) : (
          <Caption>Posting to group: {myGroups?.find((g) => g.group.id === targetGroupId)?.group.name ?? '…'}</Caption>
        )}

        {!groupId && (myGroups?.length ?? 0) > 0 ? (
          <Row gap={2} style={{ flexWrap: 'wrap' }}>
            <Caption>Post to a group instead:</Caption>
            {myGroups!
              .filter((g) => g.status === 'approved')
              .map((g) => (
                <Pill
                  key={g.group.id}
                  label={g.group.name}
                  active={targetGroupId === g.group.id}
                  onPress={() => setTargetGroupId(targetGroupId === g.group.id ? undefined : g.group.id)}
                />
              ))}
          </Row>
        ) : null}

        <Button label="Post" onPress={submit} loading={createPost.isPending} />
      </ScrollView>

      {/* No-PHI consent gate for case discussions */}
      <Modal visible={consentVisible} transparent animationType="fade" onRequestClose={() => setConsentVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: t.spacing(5) }}>
          <Card style={{ gap: t.spacing(3) }}>
            <Heading>No-PHI attestation</Heading>
            <Body>{CASE_CONSENT_TEXT}</Body>
            {phiFindings.length > 0 ? (
              <Card style={{ backgroundColor: t.colors.surfaceAlt }}>
                <Caption>⚠ Automatic screening flagged:</Caption>
                {phiFindings.map((f) => (
                  <Caption key={f.label}>
                    • {f.label} (“{f.match}”)
                  </Caption>
                ))}
                <Caption>Remove these before posting unless you are certain they are not identifiers.</Caption>
              </Card>
            ) : null}
            <Row gap={2}>
              <Button label="Go back and edit" variant="ghost" onPress={() => setConsentVisible(false)} style={{ flex: 1 }} />
              <Button
                label="I attest — post"
                onPress={() => {
                  setConsentVisible(false);
                  doSubmit(new Date().toISOString());
                }}
                style={{ flex: 1 }}
              />
            </Row>
          </Card>
        </View>
      </Modal>
    </>
  );
}
