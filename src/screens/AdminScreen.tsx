import * as Clipboard from 'expo-clipboard';
import { Pressable, Text, View } from 'react-native';

import { confirmAction } from '@/components/common/confirmAction';
import { Section } from '@/components/common/Section';
import { friendlyError } from '@/lib/format';
import { Group, Member } from '@/lib/types';
import { clearGroupChat, clearLocationPins, deleteGroup, updateMember } from '@/services/groupService';
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
  if (!activeGroup) {
    return (
      <View style={styles.stack}>
        <PrivacySection />
        <EmptyState text="Välj en aktuell grupp för gruppadministration." />
      </View>
    );
  }

  if (!canAdmin) {
    return (
      <View style={styles.stack}>
        <PrivacySection />
        <EmptyState text="Owner eller admin kan administrera vald grupp." />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <PrivacySection />
      {canOwn ? (
        <>
          <InvitationSection activeGroup={activeGroup} setNotice={setNotice} />
          <AdminRolesSection canOwn={canOwn} members={members} onRefresh={onRefresh} setBusy={setBusy} setNotice={setNotice} />
          <OwnerButton
            label="Rensa platsnålar"
            message="Platsmeddelanden tas bort permanent."
            title="Rensa platsnålar?"
            onPress={() => ownerAction(() => clearLocationPins(activeGroup.id), 'Platsnålar rensades.', { onRefresh, setBusy, setNotice })}
          />
          <OwnerButton
            label="Rensa chatt"
            message="Text, polls, svar och platsnålar tas bort permanent."
            title="Rensa chatt?"
            onPress={() => ownerAction(() => clearGroupChat(activeGroup.id), 'Chatten rensades.', { onRefresh, setBusy, setNotice })}
          />
          <OwnerButton
            label="Ta bort grupp"
            message="Medlemmar, positioner, chatt och polls tas bort."
            title="Ta bort grupp?"
            onPress={() =>
              ownerAction(() => deleteGroup(activeGroup.id), 'Gruppen togs bort.', {
                afterSuccess: () => onSelectGroup(null),
                onRefresh,
                setBusy,
                setNotice,
              })
            }
          />
        </>
      ) : (
        <>
          <AdminRolesSection canOwn={canOwn} members={members} onRefresh={onRefresh} setBusy={setBusy} setNotice={setNotice} />
          <InvitationSection activeGroup={activeGroup} setNotice={setNotice} />
        </>
      )}
    </View>
  );
}

function InvitationSection({ activeGroup, setNotice }: { activeGroup: Group; setNotice: (text: string) => void }) {
  async function copyInvite() {
    const text = [
      `Du har blivit inbjuden till ${activeGroup.name} i Fältchatt.`,
      `Gruppkod: ${activeGroup.join_code}`,
      'Ange gruppkoden i Fältchatt för att ansluta till grupp.',
      'Om du inte har ett konto behöver du först skapa ett.',
    ].join('\n');
    await Clipboard.setStringAsync(text);
    setNotice('Inbjudningstext kopierad.');
  }

  return (
    <Section title="Inbjudan">
      <Text style={styles.muted}>Dela gruppkoden med personer som ska ansöka om medlemskap.</Text>
      <Text style={styles.infoTitle}>Gruppkod: {activeGroup.join_code}</Text>
      <Pressable style={styles.secondaryButton} onPress={copyInvite}>
        <Text style={styles.secondaryButtonText}>Kopiera inbjudan</Text>
      </Pressable>
    </Section>
  );
}

function AdminRolesSection({
  canOwn,
  members,
  onRefresh,
  setBusy,
  setNotice,
}: {
  canOwn: boolean;
  members: Member[];
  onRefresh: () => Promise<void>;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
}) {
  const approvedMembers = members.filter((member) => member.status === 'approved');

  async function toggleAdmin(member: Member) {
    if (!canOwn || member.role === 'owner') return;
    try {
      setBusy(true);
      await updateMember(member.id, { role: member.role === 'admin' ? 'member' : 'admin' });
      await onRefresh();
      setNotice('Adminrollen uppdaterades.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte ändra adminroll.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Ändra admin">
      {!canOwn ? <Text style={styles.muted}>Befintliga serverregler tillåter bara owner att ändra adminroller.</Text> : null}
      {approvedMembers.map((member) => (
        <View key={member.id} style={styles.adminRoleRow}>
          <View style={styles.memberMain}>
            <Text style={styles.memberName}>{member.profiles?.alias ?? member.user_id.slice(0, 8)}</Text>
            <Text style={styles.muted}>{member.role}</Text>
          </View>
          {member.role !== 'owner' ? (
            <Pressable style={[styles.secondaryButton, !canOwn && styles.disabled, styles.roleButton]} disabled={!canOwn} onPress={() => toggleAdmin(member)}>
              <Text style={styles.secondaryButtonText}>{member.role === 'admin' ? 'Gör medlem' : 'Gör admin'}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </Section>
  );
}

function OwnerButton({
  label,
  message,
  onPress,
  title,
}: {
  label: string;
  message: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <Section title={label}>
      <Text style={styles.muted}>{message}</Text>
      <Pressable style={styles.dangerButton} onPress={() => confirmAction(title, message, onPress)}>
        <Text style={styles.dangerButtonText}>{label}</Text>
      </Pressable>
    </Section>
  );
}

async function ownerAction(
  action: () => Promise<void>,
  success: string,
  helpers: {
    afterSuccess?: () => Promise<void>;
    onRefresh: () => Promise<void>;
    setBusy: (busy: boolean) => void;
    setNotice: (text: string) => void;
  },
) {
  try {
    helpers.setBusy(true);
    await action();
    if (helpers.afterSuccess) await helpers.afterSuccess();
    await helpers.onRefresh();
    helpers.setNotice(success);
  } catch (error) {
    helpers.setNotice(friendlyError(error, 'Åtgärden misslyckades.'));
  } finally {
    helpers.setBusy(false);
  }
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}
