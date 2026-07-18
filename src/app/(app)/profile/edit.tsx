import React, { useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useSession } from '@/providers/SessionProvider';
import { useUpdateProfile, useUploadAvatar } from '@/api/profiles';
import { Avatar, Body, Button, Caption, Card, Heading, Pill, Row, Spacer, TextField } from '@/components/ui';
import { useTheme } from '@/theme';
import { OpenToKind } from '@/types/database';

const OPEN_TO: Array<{ kind: OpenToKind; label: string }> = [
  { kind: 'consulting', label: 'Consulting' },
  { kind: 'locum', label: 'Locum tenens' },
  { kind: 'telemedicine', label: 'Telemedicine' },
  { kind: 'mentorship', label: 'Mentorship' },
];

export default function EditProfile() {
  const t = useTheme();
  const router = useRouter();
  const { profile } = useSession();
  const update = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [headline, setHeadline] = useState(profile?.headline ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [specialty, setSpecialty] = useState(profile?.specialty ?? '');
  const [subspecialty, setSubspecialty] = useState(profile?.subspecialty ?? '');
  const [languages, setLanguages] = useState(profile?.languages.join(', ') ?? '');
  const [openTo, setOpenTo] = useState<OpenToKind[]>(profile?.open_to ?? []);
  const [openToOpportunities, setOpenToOpportunities] = useState(profile?.open_to_opportunities ?? false);
  const [acceptingReferrals, setAcceptingReferrals] = useState(profile?.accepting_referrals ?? false);
  const [referralSpecialty, setReferralSpecialty] = useState(profile?.referral_specialty ?? '');
  const [referralRegions, setReferralRegions] = useState(profile?.referral_regions.join(', ') ?? '');

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    uploadAvatar.mutate(result.assets[0].uri, {
      onError: (e) => Alert.alert('Upload failed', e.message),
    });
  };

  const save = () => {
    update.mutate(
      {
        full_name: fullName.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        specialty: specialty.trim() || null,
        subspecialty: subspecialty.trim() || null,
        languages: languages.split(',').map((l) => l.trim()).filter(Boolean),
        open_to: openTo,
        open_to_opportunities: openToOpportunities,
        accepting_referrals: acceptingReferrals,
        referral_specialty: referralSpecialty.trim() || null,
        referral_regions: referralRegions.split(',').map((r) => r.trim()).filter(Boolean),
      },
      {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert('Save failed', e.message),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Edit profile' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing(4), gap: t.spacing(3) }}>
        <Row gap={4}>
          <Avatar url={profile?.avatar_url} name={fullName || '?'} size={64} />
          <Button label="Change photo" variant="secondary" onPress={pickAvatar} loading={uploadAvatar.isPending} />
        </Row>

        <TextField label="Full name" value={fullName} onChangeText={setFullName} />
        <TextField label="Headline" value={headline} onChangeText={setHeadline} placeholder="Interventional Cardiologist at …" />
        <TextField
          label="About"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={5}
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        <TextField label="Specialty" value={specialty} onChangeText={setSpecialty} placeholder="Cardiology" />
        <TextField label="Subspecialty" value={subspecialty} onChangeText={setSubspecialty} placeholder="Interventional" />
        <TextField label="Languages (comma-separated)" value={languages} onChangeText={setLanguages} placeholder="English, Spanish" />

        <Card>
          <Heading>Open to</Heading>
          <Spacer size={2} />
          <Row gap={2} style={{ flexWrap: 'wrap' }}>
            {OPEN_TO.map((o) => (
              <Pill
                key={o.kind}
                label={o.label}
                active={openTo.includes(o.kind)}
                onPress={() =>
                  setOpenTo((prev) =>
                    prev.includes(o.kind) ? prev.filter((k) => k !== o.kind) : [...prev, o.kind],
                  )
                }
              />
            ))}
          </Row>
          <Spacer size={3} />
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Body>Open to opportunities</Body>
              <Caption>Visible to recruiters on job posts</Caption>
            </View>
            <Switch value={openToOpportunities} onValueChange={setOpenToOpportunities} />
          </Row>
        </Card>

        <Card>
          <Heading>Referral network</Heading>
          <Spacer size={2} />
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Body>Accepting referrals</Body>
              <Caption>Listed in the peer referral directory</Caption>
            </View>
            <Switch value={acceptingReferrals} onValueChange={setAcceptingReferrals} />
          </Row>
          {acceptingReferrals ? (
            <View style={{ gap: t.spacing(3), marginTop: t.spacing(3) }}>
              <TextField label="Referral specialty" value={referralSpecialty} onChangeText={setReferralSpecialty} />
              <TextField
                label="Regions (comma-separated states/areas)"
                value={referralRegions}
                onChangeText={setReferralRegions}
                placeholder="CA, OR, WA"
              />
            </View>
          ) : null}
        </Card>

        <Caption>
          Credentials (licenses, board certifications, education, publications) are managed from your profile page and
          the verification screen.
        </Caption>

        <Button label="Save" onPress={save} loading={update.isPending} />
      </ScrollView>
    </>
  );
}
