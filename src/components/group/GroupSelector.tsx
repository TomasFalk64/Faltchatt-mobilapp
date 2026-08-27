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
  if (!memberships.length) {
    return <Text style={styles.muted}>Välkommen. Skapa en grupp eller ansök med gruppkod.</Text>;
  }

  return (
    <View style={styles.chipWrap}>
      {memberships.map((membership) => (
        <Pressable
          key={membership.id}
          style={[styles.groupChip, membership.group_id === activeGroupId && styles.groupChipActive]}
          onPress={() => onSelectGroup(membership.group_id)}>
          <Text style={styles.groupChipTitle}>{membership.groups?.name ?? 'Grupp'}</Text>
          <Text style={styles.groupChipMeta}>{membership.status}</Text>
        </Pressable>
      ))}
    </View>
  );
}
