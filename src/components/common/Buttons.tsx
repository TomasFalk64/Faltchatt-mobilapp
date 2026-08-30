import { Pressable, Text, View } from 'react-native';

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

export function SmallIconButton({
  accessibilityLabel,
  danger,
  name,
  onPress,
  success,
}: {
  accessibilityLabel: string;
  danger?: boolean;
  name: 'check' | 'close';
  onPress: () => void;
  success?: boolean;
}) {
  const color = success ? '#34a853' : danger ? '#b42318' : '#667085';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      style={[styles.smallIconButton, success && styles.smallIconSuccess, danger && styles.smallIconDanger]}
      onPress={onPress}
    >
      {name === 'check' ? <DrawnCheck color={color} /> : <DrawnClose color={color} />}
    </Pressable>
  );
}

function DrawnCheck({ color }: { color: string }) {
  return (
    <View style={styles.drawnIcon}>
      <View style={[styles.drawnCheckShort, { backgroundColor: color }]} />
      <View style={[styles.drawnCheckLong, { backgroundColor: color }]} />
    </View>
  );
}

function DrawnClose({ color }: { color: string }) {
  return (
    <View style={styles.drawnIcon}>
      <View style={[styles.drawnCloseLine, styles.drawnCloseLineFirst, { backgroundColor: color }]} />
      <View style={[styles.drawnCloseLine, styles.drawnCloseLineSecond, { backgroundColor: color }]} />
    </View>
  );
}
