import { PropsWithChildren, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { styles } from '@/styles/faltchattStyles';

export function Section({
  children,
  collapsible = false,
  defaultCollapsed = false,
  title,
}: PropsWithChildren<{ collapsible?: boolean; defaultCollapsed?: boolean; title?: string }>) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <View style={styles.section}>
      {title && collapsible ? (
        <Pressable style={styles.sectionHeader} onPress={() => setCollapsed((value) => !value)}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionToggle}>{collapsed ? '+' : '-'}</Text>
        </Pressable>
      ) : title ? (
        <Text style={styles.sectionTitle}>{title}</Text>
      ) : null}
      {collapsed ? null : children}
    </View>
  );
}
