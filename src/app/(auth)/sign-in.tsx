import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Body, Button, Caption, Spacer, TextField, Title } from '@/components/ui';
import { useTheme } from '@/theme';

export default function SignIn() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert('Sign in failed', error.message);
    // success: AuthGate redirects into the app
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: t.spacing(6) }}
        keyboardShouldPersistTaps="handled"
      >
        <Title>GlobeMDs</Title>
        <Body muted>The professional network for physicians.</Body>
        <Spacer size={8} />
        <View style={{ gap: t.spacing(3) }}>
          <TextField
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@hospital.org"
          />
          <TextField
            label="Password"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />
          <Button label="Sign in" onPress={signIn} loading={busy} disabled={!email || !password} />
        </View>
        <Spacer size={6} />
        <Link href="/(auth)/sign-up">
          <Body>
            New to GlobeMDs? <Body muted>Create an account</Body>
          </Body>
        </Link>
        <Spacer size={2} />
        <Caption>
          Same account as GlobeMDs.com — sign in with your existing web credentials and everything stays in sync.
        </Caption>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
