import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Section } from '@/components/common/Section';
import { GroupSelector } from '@/components/group/GroupSelector';
import { GroupStatus } from '@/components/group/GroupStatus';
import { MemberList } from '@/components/group/MemberList';
import { friendlyError } from '@/lib/format';
import { Group, Member, Membership, Presence } from '@/lib/types';
import { createGroup, requestMembership } from '@/services/groupService';
import { styles } from '@/styles/faltchattStyles';

export function GroupScreen({
  activeGroup,
  activeGroupId,
  approved,
  busy,
  canAdmin,
  canOwn,
  members,
  memberships,
  onRefresh,
  onScrollToCreateGroup,
  onScrollToJoinGroup,
  onScrollToTop,
  onSelectGroup,
  presence,
  setBusy,
  setNotice,
  userId,
}: {
  activeGroup: Group | null;
  activeGroupId: string | null;
  approved: boolean;
  busy: boolean;
  canAdmin: boolean;
  canOwn: boolean;
  members: Member[];
  memberships: Membership[];
  onRefresh: () => Promise<void>;
  onScrollToCreateGroup: () => void;
  onScrollToJoinGroup: (y: number) => void;
  onScrollToTop: () => void;
  onSelectGroup: (groupId: string | null) => Promise<void>;
  presence: Presence[];
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  userId: string;
}) {
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const joinGroupY = useRef(0);
  const pendingMembership = memberships.find((membership) => membership.status === 'pending');
  const approvedMemberships = memberships.filter((membership) => membership.status === 'approved');
  const selectorMemberships = approvedMemberships.length ? memberships : [];
  const hasMemberships = memberships.length > 0;
  const pendingGroupName = pendingMembership?.groups?.name ?? 'Grupp';
  const showWelcome = !hasMemberships;

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
    const requestedCode = joinCode.trim();
    if (!requestedCode) return;
    const existingMembership = memberships.find((membership) => membership.groups?.join_code.toLowerCase() === requestedCode.toLowerCase());
    if (existingMembership?.status === 'approved') {
      setJoinCode('');
      setNotice(`Du är redan med i ${existingMembership.groups?.name ?? 'gruppen'}.`);
      return;
    }
    if (existingMembership?.status === 'pending') {
      setJoinCode('');
      setNotice(`Du har redan ansökt till ${existingMembership.groups?.name ?? 'gruppen'}.`);
      onScrollToTop();
      return;
    }
    try {
      setBusy(true);
      await requestMembership(requestedCode);
      setJoinCode('');
      await onRefresh();
      onScrollToTop();
      setNotice('Medlemsförfrågan skickad. Du är pending tills owner/admin godkänner.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte gå med i gruppen.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      {showWelcome || pendingMembership ? (
        <Section>
          {showWelcome ? (
            <View style={styles.groupStatusRow}>
              <Text style={styles.groupStatusText}>Välkommen!</Text>
            </View>
          ) : null}
          {pendingMembership ? (
            <View style={styles.groupStatusRow}>
              <Text style={styles.groupStatusText}>
                Ansökt till gruppen <Text style={styles.groupStatusStrong}>{pendingGroupName}</Text>.
              </Text>
            </View>
          ) : null}
        </Section>
      ) : null}

      <GroupSelector activeGroupId={activeGroupId} memberships={selectorMemberships} onSelectGroup={onSelectGroup} />

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

      <GroupStatus activeGroup={activeGroup} approved={approved} setNotice={setNotice} />

      <View onLayout={(event) => { joinGroupY.current = event.nativeEvent.layout.y; }}>
        <Section title="Gå med i grupp" titleStyle={styles.groupFormTitle}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="visible-password"
          onFocus={() => onScrollToJoinGroup(joinGroupY.current)}
          onSubmitEditing={handleJoinGroup}
          placeholder="Gruppkod, t.ex. vild-snäll-murkla"
          returnKeyType="done"
          style={styles.input}
          value={joinCode}
          onChangeText={setJoinCode}
        />
        <Pressable style={[styles.secondaryButton, styles.groupFormButton, busy && styles.disabled]} disabled={busy} onPress={handleJoinGroup}>
          <Text style={styles.secondaryButtonText}>Ansök</Text>
        </Pressable>
        </Section>
      </View>

      <Section title="Skapa grupp" titleStyle={styles.groupFormTitle}>
        <TextInput
          autoCorrect={false}
          onFocus={onScrollToCreateGroup}
          onSubmitEditing={handleCreateGroup}
          placeholder="Gruppnamn"
          returnKeyType="done"
          style={styles.input}
          value={groupName}
          onChangeText={setGroupName}
        />
        <Pressable style={[styles.primaryButton, styles.groupFormButton, busy && styles.disabled]} disabled={busy} onPress={handleCreateGroup}>
          <Text style={styles.primaryButtonText}>Skapa grupp</Text>
        </Pressable>
        <Text style={styles.muted}>Grupper raderas automatiskt efter 7 dagar. Max 30 personer per grupp.</Text>
        <View style={styles.groupFormBottomSpacer} />
      </Section>
    </View>
  );
}
