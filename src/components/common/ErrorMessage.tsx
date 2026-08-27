import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from '@/styles/faltchattStyles';

export function ErrorMessage({ text }: { text: string }) {
  return (
    <SafeAreaView style={styles.centerScreen}>
      <Text style={styles.brand}>Fältchatt</Text>
      <Text style={styles.muted}>{text}</Text>
    </SafeAreaView>
  );
}
