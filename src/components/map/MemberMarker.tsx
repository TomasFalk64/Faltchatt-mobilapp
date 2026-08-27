import { View } from 'react-native';
import { Callout, Marker } from 'react-native-maps';

import { FaltSymbol } from '@/components/common/FaltSymbol';
import { ACTIVE_LOCATION_MS } from '@/constants/faltchatt';
import { formatRelative } from '@/lib/format';
import { LocationRow, Member, Profile } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';
import { MemberCallout } from './MemberCallout';

export function MemberMarker({
  location,
  member,
  ownProfile,
  userId,
}: {
  location: LocationRow;
  member?: Member;
  ownProfile: Profile | null;
  userId: string;
}) {
  const own = location.user_id === userId;
  const age = Date.now() - new Date(location.updated_at).getTime();
  const stale = age > ACTIVE_LOCATION_MS;
  const profile = own ? ownProfile : member?.profiles;
  const alias = own ? 'Du' : member?.profiles?.alias ?? `Användare ${location.user_id.slice(0, 8)}`;
  const color = profile?.symbol_color ?? (own ? '#0f8bff' : '#ef4444');

  return (
    <Marker
      coordinate={{ latitude: location.latitude, longitude: location.longitude }}
      opacity={stale ? 0.42 : 1}
      title={alias}
      description={`Senast uppdaterad ${formatRelative(location.updated_at)}`}>
      <View style={[styles.mapMemberMarker, own && styles.mapOwnMarker]}>
        <View style={styles.mapMarkerSymbolWrap}>
          <FaltSymbol color={color} size={own ? 28 : 24} symbol={profile?.symbol} />
        </View>
      </View>
      <Callout>
        <MemberCallout accuracy={location.accuracy} alias={alias} color={color} member={member} own={own} ownProfile={ownProfile} updatedAt={location.updated_at} />
      </Callout>
    </Marker>
  );
}
