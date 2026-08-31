import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleProp, Text, TextStyle, View } from 'react-native';

import { styles } from '@/styles/faltchattStyles';

export function Section({
  children,
  collapsible = false,
  defaultCollapsed = false,
  title,
  titleStyle,
}: PropsWithChildren<{ collapsible?: boolean; defaultCollapsed?: boolean; title?: string; titleStyle?: StyleProp<TextStyle> }>) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <View style={styles.section}>
      {title && collapsible ? (
        <Pressable style={styles.sectionHeader} onPress={() => setCollapsed((value) => !value)}>
          <Text style={[styles.sectionTitle, titleStyle]}>{title}</Text>
          <Text style={styles.sectionToggle}>{collapsed ? '+' : '-'}</Text>
        </Pressable>
      ) : title ? (
        <Text style={[styles.sectionTitle, titleStyle]}>{title}</Text>
      ) : null}
      {collapsed ? null : children}
    </View>
  );
}
