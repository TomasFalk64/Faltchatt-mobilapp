import { Pressable, Text } from 'react-native';

import { styles } from '@/styles/faltchattStyles';

export function StatusBanner({ onClose, text, tone }: { onClose: () => void; text: string; tone?: 'success' }) {
  return (
    <Pressable style={[styles.notice, tone === 'success' && styles.noticeSuccess]} onPress={onClose}>
      <Text style={styles.noticeText}>{text}</Text>
    </Pressable>
  );
}
