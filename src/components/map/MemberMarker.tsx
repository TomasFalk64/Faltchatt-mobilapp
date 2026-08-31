import { Marker } from 'react-native-maps';

import { ACTIVE_LOCATION_MS } from '@/constants/faltchatt';
import { mapMarkerImage } from '@/lib/mapMarkerImages';
import { LocationRow, Member, Profile } from '@/lib/types';

export function MemberMarker({
  location,
  member,
  onSelect,
  ownProfile,
  userId,
}: {
  location: LocationRow;
  member?: Member;
  onSelect: (location: LocationRow, member: Member | undefined, own: boolean) => void;
  ownProfile: Profile | null;
  userId: string;
}) {
  const own = location.user_id === userId;
  const age = Date.now() - new Date(location.updated_at).getTime();
  const stale = age > ACTIVE_LOCATION_MS;
  const profile = own ? ownProfile : member?.profiles;
  const color = profile?.symbol_color ?? (own ? '#0f8bff' : '#ef4444');

  return (
    <Marker
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      coordinate={{ latitude: location.latitude, longitude: location.longitude }}
      image={mapMarkerImage(profile?.symbol, color, own)}
      opacity={stale ? 0.42 : 1}
      title=""
      onPress={(event) => {
        event.stopPropagation();
        onSelect(location, member, own);
      }}
    />
  );
}
