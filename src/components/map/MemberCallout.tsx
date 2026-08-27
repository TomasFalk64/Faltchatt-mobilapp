import { Text, View } from 'react-native';

import { symbolGlyph } from '@/constants/faltchatt';
import { formatRelative } from '@/lib/format';
import { Member } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function MemberCallout({
  accuracy,
  alias,
  member,
  own,
  updatedAt,
}: {
  accuracy: number;
  alias: string;
  member?: Member;
  own: boolean;
  updatedAt: string;
}) {
  return (
    <View style={styles.callout}>
      <Text style={styles.calloutTitle}>
        {own ? '📍' : symbolGlyph(member?.profiles?.symbol)} {alias}
      </Text>
      <Text>Senast uppdaterad {formatRelative(updatedAt)}</Text>
      <Text>Noggrannhet ±{Math.round(accuracy || 0)} m</Text>
    </View>
  );
}
