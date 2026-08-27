import { Text, View } from 'react-native';

import { SmallButton } from '@/components/common/Buttons';
import { confirmAction } from '@/components/common/confirmAction';
import { Section } from '@/components/common/Section';
import { ACTIVE_PRESENCE_MS, symbolGlyph } from '@/constants/faltchatt';
import { friendlyError } from '@/lib/format';
import { Member, Presence } from '@/lib/types';
import { leaveGroup, removeMember, updateMember } from '@/services/groupService';
import { styles } from '@/styles/faltchattStyles';

export function MemberList({
  approved,
  canAdmin,
  canOwn,
  members,
  onRefresh,
  presence,
  setBusy,
  setNotice,
  userId,
}: {
  approved: boolean;
  canAdmin: boolean;
  canOwn: boolean;
  members: Member[];
  onRefresh: () => Promise<void>;
  presence: Presence[];
  setBusy: (busy: boolean) => void;
  setNotice: (text: string) => void;
  userId: string;
}) {
  if (!approved) return null;

  async function saveMember(member: Member, patch: Partial<Member>) {
    try {
      setBusy(true);
      await updateMember(member.id, patch);
      await onRefresh();
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte uppdatera medlem.'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteMembership(member: Member) {
    try {
      setBusy(true);
      if (member.user_id === userId) await leaveGroup(member.group_id);
      else await removeMember(member.id);
      await onRefresh();
      setNotice(member.user_id === userId ? 'Du gick ur gruppen.' : 'Medlemmen togs bort.');
    } catch (error) {
      setNotice(friendlyError(error, 'Kunde inte ta bort medlemskapet.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Medlemmar">
      {members
        .slice()
        .sort(compareMembers)
        .map((member) => {
          const activePresence = presence.find((row) => row.user_id === member.user_id && Date.now() - new Date(row.last_seen).getTime() <= ACTIVE_PRESENCE_MS);
          const name = member.profiles?.alias ?? `Användare ${member.user_id.slice(0, 8)}`;
          return (
            <View key={member.id} style={styles.memberRow}>
              <Text style={[styles.symbol, { color: member.profiles?.symbol_color ?? '#111827' }]}>{symbolGlyph(member.profiles?.symbol)}</Text>
              <View style={styles.memberMain}>
                <Text style={styles.memberName}>{name}{member.user_id === userId ? ' (du)' : ''}</Text>
                <Text style={styles.muted}>
                  {member.role} · {member.status}
                  {activePresence ? ` · aktiv · delar position ${activePresence.is_sharing_location ? 'ja' : 'nej'}` : ''}
                </Text>
              </View>
              {canAdmin && member.status === 'pending' ? (
                <View style={styles.memberActions}>
                  <SmallButton label="OK" onPress={() => saveMember(member, { status: 'approved', approved_at: new Date().toISOString() } as Partial<Member>)} />
                  <SmallButton label="Avvisa" onPress={() => saveMember(member, { status: 'rejected' })} />
                </View>
              ) : null}
              {canOwn && member.status === 'approved' && member.role !== 'owner' ? (
                <View style={styles.memberActions}>
                  <SmallButton label={member.role === 'admin' ? 'member' : 'admin'} onPress={() => saveMember(member, { role: member.role === 'admin' ? 'member' : 'admin' })} />
                  <SmallButton label="Ta bort" danger onPress={() => confirmAction('Ta bort medlem?', name, () => deleteMembership(member))} />
                </View>
              ) : null}
              {member.user_id === userId ? <SmallButton label="Gå ur" danger onPress={() => confirmAction('Gå ur gruppen?', '', () => deleteMembership(member))} /> : null}
            </View>
          );
        })}
    </Section>
  );
}

function compareMembers(a: Member, b: Member) {
  const roleRank = { owner: 0, admin: 1, member: 2 };
  const statusRank = { approved: 0, pending: 1, rejected: 2 };
  const roleDiff = (roleRank[a.role] ?? 3) - (roleRank[b.role] ?? 3);
  if (roleDiff) return roleDiff;
  const statusDiff = (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3);
  if (statusDiff) return statusDiff;
  return (a.profiles?.alias ?? '').localeCompare(b.profiles?.alias ?? '', 'sv');
}
