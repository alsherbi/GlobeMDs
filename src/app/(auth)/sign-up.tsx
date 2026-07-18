import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Body, Button, Caption, Spacer, TextField, Title } from '@/components/ui';
import { useTheme } from '@/theme';

export default function SignUp() {
  const t = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const signUp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setBusy(false);
    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }
    Alert.alert(
      'Almost there',
      'Account created. After signing in you will be asked to verify your medical credentials (NPI + license) before you can post or message.',
    );
    // If email confirmation is enabled on the project, the user confirms via
    // email first; otherwise onAuthStateChange signs them straight in.
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: t.spacing(6) }}
        keyboardShouldPersistTaps="handled"
      >
        <Title>Join GlobeMDs</Title>
        <Body muted>For physicians and licensed medical professionals.</Body>
        <Spacer size={8} />
        <View style={{ gap: t.spacing(3) }}>
          <TextField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Dr. Jane Smith" />
          <TextField
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@hospital.org"
          />
          <TextField
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
          />
          <Button
            label="Create account"
            onPress={signUp}
            loading={busy}
            disabled={!fullName || !email || password.length < 8}
          />
        </View>
        <Spacer size={4} />
        <Caption>
          Membership requires credential verification (NPI number and medical license review). Until you are verified
          you can build your profile but cannot post or message.
        </Caption>
        <Spacer size={6} />
        <Link href="/(auth)/sign-in">
          <Body>
            Already a member? <Body muted>Sign in</Body>
          </Body>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
