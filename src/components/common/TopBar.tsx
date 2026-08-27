import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { signOut } from '@/services/authService';
import { styles } from '@/styles/faltchattStyles';

export function TopBar({
  alias,
  groupName,
  onOpenProfile,
  setNotice,
}: {
  alias: string;
  groupName: string;
  onOpenProfile: () => void;
  setNotice: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    setOpen(false);
    const { error } = await signOut();
    if (error) setNotice('Kunde inte logga ut.');
  }

  return (
    <View style={styles.topbar}>
      <View style={styles.topbarBrand}>
        <View style={styles.topbarIcon} />
        <Text style={styles.topbarTitle}>Fältchatt</Text>
      </View>
      <Text numberOfLines={1} style={styles.topbarGroup}>
        {groupName}
      </Text>
      <View style={styles.topbarUserWrap}>
        <Pressable style={styles.topbarUserButton} onPress={() => setOpen((value) => !value)}>
          <Text numberOfLines={1} style={styles.topbarUserText}>
            {alias}
          </Text>
        </Pressable>
        {open ? (
          <View style={styles.topbarMenu}>
            <Pressable
              style={styles.topbarMenuItem}
              onPress={() => {
                setOpen(false);
                onOpenProfile();
              }}>
              <Text style={styles.topbarMenuText}>Profil</Text>
            </Pressable>
            <Pressable style={styles.topbarMenuItem} onPress={handleSignOut}>
              <Text style={styles.topbarMenuDangerText}>Logga ut</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
