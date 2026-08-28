import * as Clipboard from 'expo-clipboard';
import { Pressable, Text, View } from 'react-native';

import { formatDate } from '@/lib/format';
import { Group } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function GroupStatus({
  activeGroup,
  approved,
  setNotice,
}: {
  activeGroup: Group | null;
  approved: boolean;
  setNotice: (text: string) => void;
}) {
  if (!activeGroup || !approved) return null;

  async function copyGroupCode() {
    if (!activeGroup) return;
    await Clipboard.setStringAsync(activeGroup.join_code);
    setNotice('Gruppkoden kopierad.');
  }

  return (
    <View style={styles.infoBox}>
      <View style={styles.codeRow}>
        <Text style={styles.label}>Gruppkod:</Text>
        <Pressable style={styles.codeButton} onPress={copyGroupCode}>
          <Text style={styles.codeButtonText}>{activeGroup.join_code}</Text>
        </Pressable>
      </View>
      <Text style={styles.muted}>Raderas automatiskt: {formatDate(activeGroup.expires_at)}</Text>
    </View>
  );
}
