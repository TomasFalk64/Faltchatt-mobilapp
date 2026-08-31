import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { SegmentButton } from '@/components/common/Buttons';
import { AuthMode } from '@/lib/appTypes';
import { friendlyError } from '@/lib/format';
import { sendPasswordReset, signIn, signUp } from '@/services/authService';
import { styles } from '@/styles/faltchattStyles';

export function AuthScreen({ setNotice }: { setNotice: (text: string) => void }) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  function keepFormVisible() {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  }

  async function submit() {
    try {
      setBusy(true);
      const result = mode === 'signup' ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
      if (result.error) throw result.error;
      setNotice(mode === 'signup' ? 'Kontot är skapat. Bekräfta e-post om Supabase kräver det.' : 'Du är inloggad.');
    } catch (error) {
      setNotice(friendlyError(error, mode === 'signup' ? 'Kunde inte skapa konto.' : 'Okänd användare eller fel lösenord.'));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      Alert.alert('E-post saknas', 'Ange din e-postadress först.');
      return;
    }
    try {
      const { error } = await sendPasswordReset(email.trim());
      if (error) throw error;
      setNotice('Länk för lösenordsåterställning skickad.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte skicka återställningslänk.'));
    }
  }

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      style={styles.authScroll}
      contentContainerStyle={[styles.auth, keyboardVisible && styles.authKeyboard]}>
      <Text style={[styles.brand, keyboardVisible && styles.brandKeyboard]}>Fältchatt</Text>
      <View style={styles.segment}>
        <SegmentButton active={mode === 'signin'} first label="Logga in" onPress={() => setMode('signin')} />
        <SegmentButton active={mode === 'signup'} last label="Skapa konto" onPress={() => setMode('signup')} />
      </View>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        onFocus={keepFormVisible}
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="E-post"
        returnKeyType="next"
        style={styles.input}
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        ref={passwordRef}
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        onFocus={keepFormVisible}
        onSubmitEditing={submit}
        placeholder="Lösenord"
        returnKeyType="done"
        secureTextEntry
        style={styles.input}
        textContentType={mode === 'signup' ? 'newPassword' : 'password'}
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={[styles.primaryButton, styles.authPrimaryButton, busy && styles.disabled]} disabled={busy} onPress={submit}>
        <Text style={styles.primaryButtonText}>{busy ? 'Vänta...' : mode === 'signup' ? 'Skapa konto' : 'Logga in'}</Text>
      </Pressable>
      <Pressable style={styles.authSecondaryButton} onPress={resetPassword}>
        <Text style={styles.authSecondaryButtonText}>Återställ lösenord</Text>
      </Pressable>
      <Text style={styles.authInfoText}>Logga in eller skapa konto för att dela position, karta och chatt med din grupp.</Text>
    </ScrollView>
  );
}
