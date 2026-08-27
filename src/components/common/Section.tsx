import { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';

import { styles } from '@/styles/faltchattStyles';

export function Section({ children, title }: PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
