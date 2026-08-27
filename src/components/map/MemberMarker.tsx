import { Callout, Marker } from 'react-native-maps';

import { ACTIVE_LOCATION_MS } from '@/constants/faltchatt';
import { formatRelative } from '@/lib/format';
import { mapMarkerImage } from '@/lib/mapMarkerImages';
import { LocationRow, Member, Profile } from '@/lib/types';
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
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      coordinate={{ latitude: location.latitude, longitude: location.longitude }}
      image={mapMarkerImage(profile?.symbol, color, own)}
      opacity={stale ? 0.42 : 1}
      title={alias}
      description={`Senast uppdaterad ${formatRelative(location.updated_at)}`}>
      <Callout>
        <MemberCallout accuracy={location.accuracy} alias={alias} color={color} member={member} own={own} ownProfile={ownProfile} updatedAt={location.updated_at} />
      </Callout>
    </Marker>
  );
}
