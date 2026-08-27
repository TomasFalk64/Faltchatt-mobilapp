import { Pressable, Text } from 'react-native';

import { styles } from '@/styles/faltchattStyles';

export function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function SmallButton({ danger, label, onPress }: { danger?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.smallButton, danger && styles.smallDanger]} onPress={onPress}>
      <Text style={[styles.smallButtonText, danger && styles.smallDangerText]}>{label}</Text>
    </Pressable>
  );
}
