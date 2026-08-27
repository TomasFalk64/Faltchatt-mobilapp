import { Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';

import { MemberMarker } from '@/components/map/MemberMarker';
import { Group, LocationRow, Member, Message } from '@/lib/types';
import { styles } from '@/styles/faltchattStyles';

const DEFAULT_REGION: Region = {
  latitude: 62,
  longitude: 15,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

export function MapScreen({
  activeGroup,
  approved,
  locations,
  locationMessages,
  mapRef,
  membersByUser,
  onOpenMessage,
  userId,
}: {
  activeGroup: Group | null;
  approved: boolean;
  locations: LocationRow[];
  locationMessages: Message[];
  mapRef: React.RefObject<MapView | null>;
  membersByUser: Map<string, Member>;
  onOpenMessage: (message: Message) => void;
  userId: string;
}) {
  return (
    <View style={styles.mapWrap}>
      <MapView ref={mapRef} style={styles.map} initialRegion={DEFAULT_REGION} showsUserLocation={false}>
        {approved
          ? locations.map((location) => (
              <MemberMarker
                key={`${location.group_id}:${location.user_id}`}
                location={location}
                member={membersByUser.get(location.user_id)}
                userId={userId}
              />
            ))
          : null}
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
      <View style={styles.mapOverlay}>
        <Text style={styles.mapTitle}>{activeGroup ? activeGroup.name : 'Ingen grupp vald'}</Text>
        <Text style={styles.mapSubtitle}>{approved ? 'Livekarta för godkända medlemmar' : 'Kartan öppnas efter godkänd grupp'}</Text>
      </View>
    </View>
  );
}
