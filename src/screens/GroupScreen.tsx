import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { GroupSelector } from '@/components/group/GroupSelector';
import { GroupStatus } from '@/components/group/GroupStatus';
import { MemberList } from '@/components/group/MemberList';
import { Section } from '@/components/common/Section';
import { friendlyError } from '@/lib/format';
import { Group, Member, Membership, Presence, Profile } from '@/lib/types';
import { createGroup, requestMembership } from '@/services/groupService';
import { styles } from '@/styles/faltchattStyles';

export function GroupScreen({
  activeGroup,
  activeGroupId,
  approved,
  busy,
  canAdmin,
  canOwn,
  locationSharingEnabled,
  members,
  memberships,
  onRefresh,
  onSelectGroup,
  onSetSharing,
  presence,
  profile,
  role,
  setBusy,
  setNotice,
  userEmail,
  userId,
}: {
  activeGroup: Group | null;
  activeGroupId: string | null;
  approved: boolean;
  busy: boolean;
  canAdmin: boolean;
  canOwn: boolean;
  locationSharingEnabled: boolean;
  members: Member[];
  memberships: Membership[];
  onRefresh: () => Promise<void>;
  onSelectGroup: (groupId: string | null) => Promise<void>;
  onSetSharing: (enabled: boolean) => Promise<void>;
  presence: Presence[];
  profile: Profile | null;
  role: string | null | undefined;
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  userEmail?: string;
  userId: string;
}) {
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  async function handleCreateGroup() {
    if (!groupName.trim()) return;
    try {
      setBusy(true);
      const groupId = await createGroup(groupName.trim());
      setGroupName('');
      await onSelectGroup(groupId);
      setNotice('Gruppen skapades. Dela gruppkoden med deltagarna.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte skapa grupp.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinGroup() {
    if (!joinCode.trim()) return;
    try {
      setBusy(true);
      await requestMembership(joinCode.trim());
      setJoinCode('');
      await onRefresh();
      setNotice('Medlemsförfrågan skickad. Du är pending tills owner/admin godkänner.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte gå med i gruppen.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <Section title="Grupp">
        <Text style={styles.muted}>Inloggad som {profile?.alias ?? userEmail}</Text>
        <GroupSelector activeGroupId={activeGroupId} memberships={memberships} onSelectGroup={onSelectGroup} />
        <GroupStatus
          activeGroup={activeGroup}
          activeGroupId={activeGroupId}
          approved={approved}
          memberships={memberships}
          role={role}
          setNotice={setNotice}
        />
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Visa och dela min position</Text>
          <Pressable style={[styles.toggle, locationSharingEnabled && styles.toggleOn]} onPress={() => onSetSharing(!locationSharingEnabled)}>
            <Text style={styles.toggleText}>{locationSharingEnabled ? 'På' : 'Av'}</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>Appen använder bara foreground-position. När delning är på frågar Expo Go om platsbehörighet.</Text>
      </Section>

      <Section title="Gå med i grupp">
        <TextInput autoCapitalize="none" placeholder="Gruppkod, t.ex. vild-snäll-murkla" style={styles.input} value={joinCode} onChangeText={setJoinCode} />
        <Pressable style={[styles.secondaryButton, busy && styles.disabled]} disabled={busy} onPress={handleJoinGroup}>
          <Text style={styles.secondaryButtonText}>Ansök</Text>
        </Pressable>
      </Section>

      <Section title="Skapa grupp">
        <TextInput placeholder="Gruppnamn" style={styles.input} value={groupName} onChangeText={setGroupName} />
        <Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={handleCreateGroup}>
          <Text style={styles.primaryButtonText}>Skapa grupp</Text>
        </Pressable>
        <Text style={styles.muted}>Grupper raderas automatiskt efter 7 dagar. Max 30 personer per grupp och max 30 pågående grupper totalt.</Text>
      </Section>

      <MemberList
        approved={approved}
        canAdmin={canAdmin}
        canOwn={canOwn}
        members={members}
        onRefresh={onRefresh}
        presence={presence}
        setBusy={setBusy}
        setNotice={setNotice}
        userId={userId}
      />
    </View>
  );
}
