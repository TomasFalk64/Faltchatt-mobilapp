import { useMemo, useState } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';

import { ClusterMarker } from '@/components/map/ClusterMarker';
import { MemberMarker } from '@/components/map/MemberMarker';
import { distanceMeters } from '@/lib/format';
import { LocationRow, Member, Message, Profile } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

const DEFAULT_REGION: Region = {
  latitude: 62,
  longitude: 15,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

export function MapScreen({
  approved,
  locations,
  locationMessages,
  mapRef,
  membersByUser,
  onOpenMessage,
  ownLocation,
  profile,
  userId,
}: {
  approved: boolean;
  locations: LocationRow[];
  locationMessages: Message[];
  mapRef: React.RefObject<MapView | null>;
  membersByUser: Map<string, Member>;
  onOpenMessage: (message: Message) => void;
  ownLocation: LocationRow | null;
  profile: Profile | null;
  userId: string;
}) {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const groupedLocations = useMemo(() => {
    const visibleLocations = ownLocation && !locations.some((location) => location.user_id === userId) ? [...locations, ownLocation] : locations;
    return groupNearbyLocations(visibleLocations, region);
  }, [locations, ownLocation, region, userId]);

  return (
    <View style={styles.mapWrap}>
      <MapView ref={mapRef} style={styles.map} initialRegion={DEFAULT_REGION} showsUserLocation={false} onRegionChangeComplete={setRegion}>
        {groupedLocations.map((group) => {
          if (group.length > 5) {
            return <ClusterMarker key={group.map((location) => location.user_id).sort().join('|')} group={group} membersByUser={membersByUser} ownProfile={profile} userId={userId} />;
          }
          return memberOffsets(group.length, region).map((offset, index) => {
            const location = group[index];
            return (
              <MemberMarker
                key={`${location.group_id}:${location.user_id}`}
                location={{ ...location, latitude: location.latitude + offset.latitude, longitude: location.longitude + offset.longitude }}
                member={membersByUser.get(location.user_id)}
                ownProfile={profile}
                userId={userId}
              />
            );
          });
        })}
        {approved
          ? locationMessages.map((message) => (
              <Marker
                key={message.id}
                coordinate={{ latitude: message.latitude!, longitude: message.longitude! }}
                pinColor="#111827"
                title={message.text || 'Platsmeddelande'}
                description="Tryck för att öppna i chatten"
                onPress={() => onOpenMessage(message)}
              />
            ))
          : null}
      </MapView>
    </View>
  );
}

function groupNearbyLocations(locations: LocationRow[], region: Region) {
  const groups: { center: LocationRow; items: LocationRow[] }[] = [];
  const thresholdMeters = Math.max(8, (region.longitudeDelta * 111_320 * 18) / 390);
  locations.forEach((location) => {
    const group = groups.find((item) => distanceMeters(item.center.latitude, item.center.longitude, location.latitude, location.longitude) <= thresholdMeters);
    if (group) {
      group.items.push(location);
      group.center = averageLocation(group.items);
    } else {
      groups.push({ center: location, items: [location] });
    }
  });
  return groups.map((group) => group.items);
}

function averageLocation(locations: LocationRow[]) {
  const total = locations.reduce(
    (sum, location) => ({ latitude: sum.latitude + location.latitude, longitude: sum.longitude + location.longitude }),
    { latitude: 0, longitude: 0 },
  );
  return { ...locations[0], latitude: total.latitude / locations.length, longitude: total.longitude / locations.length };
}

function memberOffsets(count: number, region: Region) {
  if (count <= 1) return [{ latitude: 0, longitude: 0 }];
  const radiusPx = count === 2 ? 8 : 10;
  const latitudePerPx = region.latitudeDelta / 285;
  const longitudePerPx = region.longitudeDelta / 390;
  const startAngle = count === 2 ? Math.PI : -Math.PI / 2;
  return Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (index * 2 * Math.PI) / count;
    return {
      latitude: Math.sin(angle) * radiusPx * latitudePerPx,
      longitude: Math.cos(angle) * radiusPx * longitudePerPx,
    };
  });
}
