import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

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
      setNotice('Ange e-post först.');
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
    <ScrollView contentContainerStyle={styles.auth}>
      <Text style={styles.brand}>Fältchatt</Text>
      <Text style={styles.lead}>Logga in eller skapa konto för att dela position, karta och chatt med din grupp.</Text>
      <View style={styles.segment}>
        <SegmentButton active={mode === 'signin'} label="Logga in" onPress={() => setMode('signin')} />
        <SegmentButton active={mode === 'signup'} label="Skapa konto" onPress={() => setMode('signup')} />
      </View>
      <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="E-post" style={styles.input} value={email} onChangeText={setEmail} />
      <TextInput placeholder="Lösenord" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
      <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={submit}>
        <Text style={styles.primaryButtonText}>{busy ? 'Vänta...' : mode === 'signup' ? 'Skapa konto' : 'Logga in'}</Text>
      </Pressable>
      <Pressable style={styles.textButton} onPress={resetPassword}>
        <Text style={styles.textButtonText}>Återställ lösenord</Text>
      </Pressable>
    </ScrollView>
  );
}
