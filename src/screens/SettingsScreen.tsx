import { useEffect, useState } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { MapType } from 'react-native-maps';

import { confirmAction } from '@/components/common/confirmAction';
import { FaltSymbol } from '@/components/common/FaltSymbol';
import { Section } from '@/components/common/Section';
import { SYMBOL_COLORS, SYMBOLS } from '@/constants/faltchatt';
import { friendlyError } from '@/lib/format';
import { Profile } from '@/lib/types';
import { deleteAccount, saveProfile, signOut, updatePassword } from '@/services/authService';
import { MESSAGE_SOUND_OPTIONS, MessageSoundId } from '@/services/messageSoundService';
import { styles } from '@/styles/faltchattStyles';

const MAP_TYPE_OPTIONS: { label: string; value: MapType }[] = [
  { label: 'Standard', value: 'standard' },
  { label: 'Satellit', value: 'satellite' },
  { label: 'Hybrid', value: 'hybrid' },
];

export function SettingsScreen({
  backgroundLocationActive,
  backgroundLocationSharingEnabled,
  backgroundLocationStatus,
  locationSharingEnabled,
  mapType,
  messageSound,
  onPasswordRecoveryDone,
  onRefresh,
  onSetBackgroundLocationSharingEnabled,
  onSetMapType,
  onSetMessageSound,
  onSetSharing,
  onSetShowGroupMapOverlay,
  passwordRecovery,
  profile,
  setBusy,
  setNotice,
  showGroupMapOverlay,
  userEmail,
  userId,
}: {
  backgroundLocationActive: boolean;
  backgroundLocationSharingEnabled: boolean;
  backgroundLocationStatus: string;
  locationSharingEnabled: boolean;
  mapType: MapType;
  messageSound: MessageSoundId;
  onPasswordRecoveryDone: () => void;
  onRefresh: () => Promise<void>;
  onSetBackgroundLocationSharingEnabled: (enabled: boolean) => Promise<void>;
  onSetMapType: (mapType: MapType) => Promise<void>;
  onSetMessageSound: (sound: MessageSoundId) => Promise<void>;
  onSetSharing: (enabled: boolean) => Promise<void>;
  onSetShowGroupMapOverlay: (show: boolean) => Promise<void>;
  passwordRecovery: boolean;
  profile: Profile | null;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  showGroupMapOverlay: boolean;
  userEmail?: string;
  userId: string;
}) {
  const [alias, setAlias] = useState(profile?.alias ?? '');
  const [symbol, setSymbol] = useState(profile?.symbol ?? SYMBOLS[0].id);
  const [color, setColor] = useState(profile?.symbol_color ?? SYMBOL_COLORS[0]);
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');

  function cycleMessageSound() {
    const currentIndex = MESSAGE_SOUND_OPTIONS.findIndex((item) => item.value === messageSound);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % MESSAGE_SOUND_OPTIONS.length : 0;
    onSetMessageSound(MESSAGE_SOUND_OPTIONS[nextIndex].value);
  }

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
        <View style={styles.inputRow}>
          <Text style={styles.label}>Alias:</Text>
          <TextInput placeholder="Alias" style={[styles.input, styles.inputRowField]} value={alias} onChangeText={setAlias} />
        </View>
        <Text style={styles.label}>Symbol</Text>
        <View style={styles.chipWrap}>
          {SYMBOLS.map((item) => {
            const pickerSize = item.id === 'train' ? 38 : item.id === 'hat' ? 25 : 38;
            const pickerOffset = item.id === 'train' ? -3 : item.id === 'hat' ? 1 : 0;
            return (
              <Pressable key={item.id} style={[styles.symbolChoice, symbol === item.id && styles.symbolChoiceActive]} onPress={() => setSymbol(item.id)}>
                <FaltSymbol color="#111827" size={pickerSize} style={pickerOffset ? { transform: [{ translateY: pickerOffset }] } : undefined} symbol={item.id} />
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.label}>Symbolfärg</Text>
        <View style={styles.colorWrap}>
          {SYMBOL_COLORS.map((item) => (
            <Pressable key={item} style={[styles.swatch, { backgroundColor: item }, color === item && styles.swatchActive]} onPress={() => setColor(item)} />
          ))}
        </View>
        <View style={styles.profileButtonRow}>
          <Pressable style={[styles.primaryButton, styles.profileButton]} onPress={handleSaveProfile}>
            <Text style={styles.primaryButtonText}>Spara profil</Text>
          </Pressable>
        </View>
        <View style={styles.preferenceDivider} />
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Baskarta:</Text>
          <View style={styles.segmentedControl}>
            {MAP_TYPE_OPTIONS.map((item) => (
              <Pressable
                key={item.value}
                style={[styles.segmentedButton, mapType === item.value && styles.segmentedButtonActive]}
                onPress={() => onSetMapType(item.value)}>
                <Text style={[styles.segmentedText, mapType === item.value && styles.segmentedTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Uppladdad karta:</Text>
          <View style={styles.segmentedControl}>
            <Pressable
              style={[styles.segmentedButton, showGroupMapOverlay && styles.segmentedButtonActive]}
              onPress={() => onSetShowGroupMapOverlay(true)}>
              <Text style={[styles.segmentedText, showGroupMapOverlay && styles.segmentedTextActive]}>Visa</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentedButton, !showGroupMapOverlay && styles.segmentedButtonActive]}
              onPress={() => onSetShowGroupMapOverlay(false)}>
              <Text style={[styles.segmentedText, !showGroupMapOverlay && styles.segmentedTextActive]}>Dölj</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Meddelandeljud:</Text>
          <View style={styles.segmentedControl}>
            <Pressable style={[styles.segmentedButton, styles.segmentedButtonActive]} onPress={cycleMessageSound}>
              <Text style={styles.segmentedTextActive}>{MESSAGE_SOUND_OPTIONS.find((item) => item.value === messageSound)?.label ?? 'Golgroda'}</Text>
            </Pressable>
          </View>
        </View>
        <Pressable style={styles.checkboxRow} onPress={() => onSetSharing(!locationSharingEnabled)}>
          <View style={[styles.checkbox, locationSharingEnabled && styles.checkboxChecked]}>
            {locationSharingEnabled ? <MaterialCommunityIcons color="#ffffff" name="check" size={16} /> : null}
          </View>
          <Text style={styles.label}>Visa och dela min position</Text>
        </Pressable>
        <Pressable style={styles.checkboxRow} onPress={() => onSetBackgroundLocationSharingEnabled(!backgroundLocationSharingEnabled)}>
          <View style={[styles.checkbox, backgroundLocationSharingEnabled && styles.checkboxChecked]}>
            {backgroundLocationSharingEnabled ? <MaterialCommunityIcons color="#ffffff" name="check" size={16} /> : null}
          </View>
          <Text style={styles.label}>Dela även i bakgrunden</Text>
        </Pressable>
        {backgroundLocationStatus ? (
          <Text style={[styles.preferenceStatus, backgroundLocationActive ? styles.preferenceStatusActive : styles.warning]}>{backgroundLocationStatus}</Text>
        ) : null}
        <View style={styles.profileButtonRow}>
          <Pressable style={[styles.secondaryButton, styles.profileButton]} onPress={() => signOut()}>
            <Text style={styles.secondaryButtonText}>Logga ut</Text>
          </Pressable>
          <Pressable style={[styles.dangerButton, styles.profileButton]} onPress={() => confirmAction('Ta bort kontot permanent?', 'Det går inte att ångra.', handleDeleteAccount)}>
            <Text style={styles.dangerButtonText}>Ta bort mitt konto</Text>
          </Pressable>
        </View>
      </Section>
    </View>
  );
}

export function PrivacySection({ collapsible = false, defaultCollapsed = false }: { collapsible?: boolean; defaultCollapsed?: boolean } = {}) {
  return (
    <Section collapsible={collapsible} defaultCollapsed={defaultCollapsed} title="Integritet">
      <Text style={styles.paragraph}>Fältchatt är en enkel gruppapp för fältarbete där medlemmar kan dela chatt och position inom vald grupp.</Text>
      <Text style={styles.paragraph}>Appen lagrar alias, vald symbol, symbolfärg, gruppmedlemskap, chatt, polls och platsdata som du själv delar.</Text>
      <Text style={styles.paragraph}>E-post används bara av Supabase Auth för inloggning, bekräftelse, lösenordsåterställning och eventuell kontovarning. Vanliga app-tabeller lagrar inte e-postadresser.</Text>
      <Text style={styles.paragraph}>Positionsdelning styrs i Profil och använder bara foreground-position i denna mobilversion.</Text>
      <Text style={styles.paragraph}>Grupper är tillfälliga och raderas automatiskt efter 7 dagar. Max 30 personer kan vara approved eller pending i samma grupp.</Text>
    </Section>
  );
}
