import { Text, View } from 'react-native';
import { Callout, Marker } from 'react-native-maps';

import { FaltSymbol } from '@/components/common/FaltSymbol';
import { formatRelative } from '@/lib/format';
import { CLUSTER_MARKER_IMAGE } from '@/lib/mapMarkerImages';
import { LocationRow, Member, Profile } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

export function ClusterMarker({
  group,
  membersByUser,
  ownProfile,
  userId,
}: {
  group: LocationRow[];
  membersByUser: Map<string, Member>;
  ownProfile: Profile | null;
  userId: string;
}) {
  const center = averageLocation(group);

  return (
    <Marker anchor={{ x: 0.5, y: 0.5 }} centerOffset={{ x: 0, y: 0 }} coordinate={{ latitude: center.latitude, longitude: center.longitude }} image={CLUSTER_MARKER_IMAGE} title="Flera personer här">
      <Callout>
        <View style={styles.clusterCallout}>
          <Text style={styles.calloutTitle}>Flera personer här</Text>
          {group.map((location) => {
            const own = location.user_id === userId;
            const profile = own ? ownProfile : membersByUser.get(location.user_id)?.profiles;
            const alias = own ? 'Du' : profile?.alias ?? `Användare ${location.user_id.slice(0, 8)}`;
            return (
              <View key={location.user_id} style={styles.clusterCalloutRow}>
                <FaltSymbol color={profile?.symbol_color} size={16} symbol={profile?.symbol} />
                <Text style={styles.clusterCalloutText}>{alias} · {formatRelative(location.updated_at)}</Text>
              </View>
            );
          })}
        </View>
      </Callout>
    </Marker>
  );
}

function averageLocation(locations: LocationRow[]) {
  const total = locations.reduce(
    (sum, location) => ({ latitude: sum.latitude + location.latitude, longitude: sum.longitude + location.longitude }),
    { latitude: 0, longitude: 0 },
  );
  return { latitude: total.latitude / locations.length, longitude: total.longitude / locations.length };
}
