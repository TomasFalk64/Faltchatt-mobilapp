import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Membership } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function GroupSelector({
  activeGroupId,
  memberships,
  onSelectGroup,
}: {
  activeGroupId: string | null;
  memberships: Membership[];
  onSelectGroup: (groupId: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = useMemo(() => {
    if (!activeGroupId) return 'Ingen grupp vald';
    const selected = memberships.find((membership) => membership.group_id === activeGroupId);
    return selected?.groups?.name ?? 'Ingen grupp vald';
  }, [activeGroupId, memberships]);
  const membershipState = useMemo(
    () => memberships.map((membership) => `${membership.group_id}:${membership.status}`).join('|'),
    [memberships],
  );

  useEffect(() => {
    setOpen(false);
  }, [activeGroupId, membershipState]);

  if (!memberships.length) {
    return null;
  }

  return (
    <View style={styles.dropdownBlock}>
      <View style={styles.groupSelectorRow}>
        <Text style={styles.label}>Aktuell grupp:</Text>
        <Pressable style={styles.dropdownButton} onPress={() => setOpen((value) => !value)}>
          <Text style={styles.dropdownButtonText}>{selectedLabel}</Text>
          <Text style={styles.dropdownCaret}>{open ? '▲' : '▼'}</Text>
        </Pressable>
      </View>
      {open ? (
        <View style={styles.dropdownMenu}>
          <Pressable
            style={[styles.dropdownOption, !activeGroupId && styles.dropdownOptionActive]}
            onPress={async () => {
              setOpen(false);
              await onSelectGroup(null);
            }}>
            <Text style={styles.dropdownOptionTitle}>Ingen grupp vald</Text>
          </Pressable>
          {memberships.map((membership) => (
            <Pressable
              key={membership.id}
              disabled={membership.status !== 'approved'}
              style={[styles.dropdownOption, membership.group_id === activeGroupId && styles.dropdownOptionActive]}
              onPress={async () => {
                setOpen(false);
                await onSelectGroup(membership.group_id);
              }}>
              <View style={styles.dropdownOptionRow}>
                <Text style={styles.dropdownOptionTitle}>{membership.groups?.name ?? 'Grupp'}</Text>
                {membership.status === 'pending' ? <Text style={styles.dropdownOptionMeta}>pending</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
