import * as Clipboard from 'expo-clipboard';
import { Pressable, Text, View } from 'react-native';

import { confirmAction } from '@/components/common/confirmAction';
import { Section } from '@/components/common/Section';
import { Group, Member } from '@/lib/types';
import { clearGroupChat, clearLocationPins, deleteGroup } from '@/services/groupService';
import { styles } from '@/styles/faltchattStyles';
import { PrivacySection } from './SettingsScreen';

export function AdminScreen({
  activeGroup,
  canAdmin,
  canOwn,
  members,
  onRefresh,
  onSelectGroup,
  setBusy,
  setNotice,
}: {
  activeGroup: Group | null;
  canAdmin: boolean;
  canOwn: boolean;
  members: Member[];
  onRefresh: () => Promise<void>;
  onSelectGroup: (groupId: string | null) => Promise<void>;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
}) {
  if (!activeGroup) return <EmptyState text="Välj grupp för administration." />;
  if (!canAdmin) return <PrivacySection />;

  async function ownerAction(action: () => Promise<void>, success: string, clearGroup = false) {
    try {
      setBusy(true);
      await action();
      if (clearGroup) await onSelectGroup(null);
      await onRefresh();
      setNotice(success);
    } catch {
      setNotice('Åtgärden misslyckades.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <Section title="Administration">
        <Text style={styles.infoTitle}>{activeGroup.name}</Text>
        <Text style={styles.muted}>Owner/admin kan godkänna pending-medlemmar. Bara owner kan rensa eller ta bort gruppen.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => Clipboard.setStringAsync(`Gruppkod: ${activeGroup.join_code}`)}>
          <Text style={styles.secondaryButtonText}>Kopiera gruppkod</Text>
        </Pressable>
      </Section>
      <Section title="Roller">
        {members.filter((member) => member.status === 'approved').map((member) => (
          <Text key={member.id} style={styles.muted}>
            {member.profiles?.alias ?? member.user_id.slice(0, 8)} · {member.role}
          </Text>
        ))}
      </Section>
      {canOwn ? (
        <Section title="Owner-verktyg">
          <Pressable style={styles.dangerButton} onPress={() => confirmAction('Rensa platsnålar?', 'Platsmeddelanden tas bort permanent.', () => ownerAction(() => clearLocationPins(activeGroup.id), 'Platsnålar rensades.'))}>
            <Text style={styles.dangerButtonText}>Rensa platsnålar</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={() => confirmAction('Rensa chatt?', 'Text, polls, svar och platsnålar tas bort permanent.', () => ownerAction(() => clearGroupChat(activeGroup.id), 'Chatten rensades.'))}>
            <Text style={styles.dangerButtonText}>Rensa chatt</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={() => confirmAction('Ta bort grupp?', 'Medlemmar, positioner, chatt och polls tas bort.', () => ownerAction(() => deleteGroup(activeGroup.id), 'Gruppen togs bort.', true))}>
            <Text style={styles.dangerButtonText}>Ta bort grupp</Text>
          </Pressable>
        </Section>
      ) : null}
      <PrivacySection />
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}
