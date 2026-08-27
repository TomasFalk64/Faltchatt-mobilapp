import { ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from '@/styles/faltchattStyles';

export function LoadingState({ text = 'Laddar Fältchatt...' }: { text?: string }) {
  return (
    <SafeAreaView style={styles.centerScreen}>
      <ActivityIndicator />
      <Text style={styles.muted}>{text}</Text>
    </SafeAreaView>
  );
}
