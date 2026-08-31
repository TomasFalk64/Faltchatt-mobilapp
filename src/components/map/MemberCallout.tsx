import { Text, View } from 'react-native';

import { FaltSymbol } from '@/components/common/FaltSymbol';
import { formatRelative } from '@/lib/format';
import { Member, Profile } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function MemberCallout({
  accuracy,
  alias,
  color,
  member,
  own,
  ownProfile,
  updatedAt,
}: {
  accuracy: number;
  alias: string;
  color: string;
  member?: Member;
  own: boolean;
  ownProfile: Profile | null;
  updatedAt: string;
}) {
  const profile = own ? ownProfile : member?.profiles;

  return (
    <View style={styles.callout}>
      <View style={styles.calloutTitleRow}>
        <FaltSymbol color={color} size={18} symbol={profile?.symbol} />
        <Text style={styles.calloutTitle}>{alias}</Text>
      </View>
      <Text>{formatRelative(updatedAt)}</Text>
      <Text>Noggrannhet ±{Math.round(accuracy || 0)} m</Text>
    </View>
  );
}
