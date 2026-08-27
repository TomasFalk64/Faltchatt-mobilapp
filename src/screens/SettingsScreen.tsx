import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { confirmAction } from '@/components/common/confirmAction';
import { FaltSymbol } from '@/components/common/FaltSymbol';
import { Section } from '@/components/common/Section';
import { SYMBOL_COLORS, SYMBOLS } from '@/constants/faltchatt';
import { friendlyError } from '@/lib/format';
import { Profile } from '@/lib/types';
import { deleteAccount, saveProfile, signOut, updatePassword } from '@/services/authService';
import { styles } from '@/styles/faltchattStyles';

export function SettingsScreen({
  locationSharingEnabled,
  onPasswordRecoveryDone,
  onRefresh,
  onSetSharing,
  passwordRecovery,
  profile,
  setBusy,
  setNotice,
  userEmail,
  userId,
}: {
  locationSharingEnabled: boolean;
  onPasswordRecoveryDone: () => void;
  onRefresh: () => Promise<void>;
  onSetSharing: (enabled: boolean) => Promise<void>;
  passwordRecovery: boolean;
  profile: Profile | null;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  userEmail?: string;
  userId: string;
}) {
  const [alias, setAlias] = useState(profile?.alias ?? '');
  const [symbol, setSymbol] = useState(profile?.symbol ?? SYMBOLS[0].id);
  const [color, setColor] = useState(profile?.symbol_color ?? SYMBOL_COLORS[0]);
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');

  useEffect(() => {
    setAlias(profile?.alias ?? '');
    setSymbol(profile?.symbol ?? SYMBOLS[0].id);
    setColor(profile?.symbol_color ?? SYMBOL_COLORS[0]);
  }, [profile]);

  async function handleSaveProfile() {
    try {
      setBusy(true);
      await saveProfile({
        id: userId,
        alias: alias.trim() || 'Fältanvändare',
        symbol,
        symbol_color: color,
      });
      await onRefresh();
      setNotice('Profilen sparades.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte spara profilen.'));
    } finally {
      setBusy(false);
    }
  }

  async function savePassword() {
    if (newPassword.length < 6) {
      setNotice('Lösenordet måste vara minst 6 tecken.');
      return;
    }
    if (newPassword !== repeatPassword) {
      setNotice('Lösenorden är inte lika.');
      return;
    }
    try {
      setBusy(true);
      const { error } = await updatePassword(newPassword);
      if (error) throw error;
      setNewPassword('');
      setRepeatPassword('');
      onPasswordRecoveryDone();
      setNotice('Lösenordet har ändrats.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte ändra lösenordet.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAccount() {
    Alert.prompt('Ta bort mitt konto', `Skriv din e-postadress för att bekräfta:\n${userEmail ?? ''}`, async (typedEmail) => {
      if ((typedEmail ?? '').trim().toLowerCase() !== (userEmail ?? '').trim().toLowerCase()) {
        setNotice('E-postadressen matchar inte kontot.');
        return;
      }
      try {
        setBusy(true);
        const { error } = await deleteAccount(typedEmail.trim());
        if (error) throw error;
        await signOut().catch(() => {});
      } catch (error) {
        setNotice(friendlyError(error, 'Kunde inte ta bort kontot. Kontrollera att Edge Function delete-my-account är deployad.'));
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <View style={styles.stack}>
      <Section>
        {passwordRecovery ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Välj nytt lösenord</Text>
            <TextInput placeholder="Nytt lösenord" secureTextEntry style={styles.input} value={newPassword} onChangeText={setNewPassword} />
            <TextInput placeholder="Upprepa nytt lösenord" secureTextEntry style={styles.input} value={repeatPassword} onChangeText={setRepeatPassword} />
            <Pressable style={styles.primaryButton} onPress={savePassword}>
              <Text style={styles.primaryButtonText}>Spara nytt lösenord</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.label}>Alias:</Text>
        <TextInput placeholder="Alias" style={styles.input} value={alias} onChangeText={setAlias} />
        <Text style={styles.label}>Symbol</Text>
        <View style={styles.chipWrap}>
          {SYMBOLS.map((item) => (
            <Pressable key={item.id} style={[styles.symbolChoice, symbol === item.id && styles.symbolChoiceActive]} onPress={() => setSymbol(item.id)}>
              <FaltSymbol color={color} size={28} symbol={item.id} />
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Symbolfärg</Text>
        <View style={styles.colorWrap}>
          {SYMBOL_COLORS.map((item) => (
            <Pressable key={item} style={[styles.swatch, { backgroundColor: item }, color === item && styles.swatchActive]} onPress={() => setColor(item)} />
          ))}
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Visa och dela min position</Text>
          <Pressable style={[styles.toggle, locationSharingEnabled && styles.toggleOn]} onPress={() => onSetSharing(!locationSharingEnabled)}>
            <Text style={styles.toggleText}>{locationSharingEnabled ? 'På' : 'Av'}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.primaryButton} onPress={handleSaveProfile}>
          <Text style={styles.primaryButtonText}>Spara profil</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => signOut()}>
          <Text style={styles.secondaryButtonText}>Logga ut</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={() => confirmAction('Ta bort kontot permanent?', 'Det går inte att ångra.', handleDeleteAccount)}>
          <Text style={styles.dangerButtonText}>Ta bort mitt konto</Text>
        </Pressable>
      </Section>
    </View>
  );
}

export function PrivacySection() {
  return (
    <Section title="Integritet">
      <Text style={styles.paragraph}>Fältchatt är en enkel gruppapp för fältarbete där medlemmar kan dela chatt och position inom vald grupp.</Text>
      <Text style={styles.paragraph}>Appen lagrar alias, vald symbol, symbolfärg, gruppmedlemskap, chatt, polls och platsdata som du själv delar.</Text>
      <Text style={styles.paragraph}>E-post används bara av Supabase Auth för inloggning, bekräftelse, lösenordsåterställning och eventuell kontovarning. Vanliga app-tabeller lagrar inte e-postadresser.</Text>
      <Text style={styles.paragraph}>Positionsdelning styrs i Profil och använder bara foreground-position i denna mobilversion.</Text>
      <Text style={styles.paragraph}>Grupper är tillfälliga och raderas automatiskt efter 7 dagar. Max 30 personer kan vara approved eller pending i samma grupp.</Text>
    </Section>
  );
}
