import { Callout, Marker } from 'react-native-maps';

import { ACTIVE_LOCATION_MS } from '@/constants/faltchatt';
import { formatRelative } from '@/lib/format';
import { LocationRow, Member } from '@/lib/types';
import { MemberCallout } from './MemberCallout';

export function MemberMarker({ location, member, userId }: { location: LocationRow; member?: Member; userId: string }) {
  const own = location.user_id === userId;
  const age = Date.now() - new Date(location.updated_at).getTime();
  const stale = age > ACTIVE_LOCATION_MS;
  const alias = own ? 'Du' : member?.profiles?.alias ?? `Användare ${location.user_id.slice(0, 8)}`;

  return (
    <Marker
      coordinate={{ latitude: location.latitude, longitude: location.longitude }}
      opacity={stale ? 0.42 : 1}
      pinColor={own ? '#0f8bff' : member?.profiles?.symbol_color ?? '#ef4444'}
      title={alias}
      description={`Senast uppdaterad ${formatRelative(location.updated_at)}`}>
      <Callout>
        <MemberCallout accuracy={location.accuracy} alias={alias} member={member} own={own} updatedAt={location.updated_at} />
      </Callout>
    </Marker>
  );
}
