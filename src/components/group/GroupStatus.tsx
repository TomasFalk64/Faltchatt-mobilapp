import * as Clipboard from 'expo-clipboard';
import { Pressable, Text, View } from 'react-native';

import { formatDateTime } from '@/lib/format';
import { Group, Membership } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function GroupStatus({
  activeGroup,
  activeGroupId,
  approved,
  memberships,
  role,
  setNotice,
}: {
  activeGroup: Group | null;
  activeGroupId: string | null;
  approved: boolean;
  memberships: Membership[];
  role: string | null | undefined;
  setNotice: (text: string) => void;
}) {
  if (!activeGroup) return null;

  async function copyInvite() {
    if (!activeGroup) return;
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
    <View style={styles.infoBox}>
      <Text style={styles.infoTitle}>{activeGroup.name}</Text>
      <Text>Gruppkod: {activeGroup.join_code}</Text>
      <Text>Roll/status: {role ?? memberships.find((item) => item.group_id === activeGroupId)?.status}</Text>
      <Text>Raderas automatiskt: {formatDateTime(activeGroup.expires_at)}</Text>
      {!approved ? <Text style={styles.warning}>Du väntar på godkännande innan karta och chatt öppnas.</Text> : null}
      <Pressable style={styles.secondaryButton} onPress={copyInvite}>
        <Text style={styles.secondaryButtonText}>Kopiera inbjudan</Text>
      </Pressable>
    </View>
  );
}
