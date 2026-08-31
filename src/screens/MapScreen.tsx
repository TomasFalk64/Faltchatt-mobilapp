import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import MapView, { LatLng, MapType, Marker, Overlay, PROVIDER_GOOGLE, Region } from 'react-native-maps';

import { ClusterMarker } from '@/components/map/ClusterMarker';
import { MemberCallout } from '@/components/map/MemberCallout';
import { MemberMarker } from '@/components/map/MemberMarker';
import { distanceMeters } from '@/lib/format';
import { LocationRow, Member, Message, Profile } from '@/lib/types';
import type { GroupMapOverlay } from '@/services/mapService';
import { styles } from '@/styles/faltchattStyles';

const DEFAULT_REGION: Region = {
  latitude: 62,
  longitude: 15,
  latitudeDelta: 12,
  longitudeDelta: 12,
};

export function MapScreen({
  approved,
  groupMapOverlay,
  locations,
  locationMessages,
  mapRef,
  mapTarget,
  mapType,
  membersByUser,
  onInputFocusChange,
  onSendLocationMessage,
  ownLocation,
  profile,
  showGroupMapOverlay,
  userId,
}: {
  approved: boolean;
  groupMapOverlay: GroupMapOverlay | null;
  locations: LocationRow[];
  locationMessages: Message[];
  mapRef: React.RefObject<MapView | null>;
  mapTarget: { latitude: number; longitude: number; messageId?: string; text?: string } | null;
  mapType: MapType;
  membersByUser: Map<string, Member>;
  onInputFocusChange: (focused: boolean) => void;
  onSendLocationMessage: (text: string, latitude: number, longitude: number) => Promise<void>;
  ownLocation: LocationRow | null;
  profile: Profile | null;
  showGroupMapOverlay: boolean;
  userId: string;
}) {
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [hiddenLocationMessageIds, setHiddenLocationMessageIds] = useState<Set<string>>(new Set());
  const [selectedLocationMessageId, setSelectedLocationMessageId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<{ userId: string; member?: Member; own: boolean } | null>(null);
  const [sendCoordinate, setSendCoordinate] = useState<LatLng | null>(null);
  const [sendText, setSendText] = useState('Ses här om 20 min');
  const [sending, setSending] = useState(false);
  const groupedLocations = useMemo(() => {
    const visibleLocations = ownLocation && !locations.some((location) => location.user_id === userId) ? [...locations, ownLocation] : locations;
    return groupNearbyLocations(visibleLocations, region);
  }, [locations, ownLocation, region, userId]);
  const selectedMemberLocation = useMemo(() => {
    if (!selectedMember) return null;
    const location =
      (selectedMember.own && ownLocation?.user_id === selectedMember.userId ? ownLocation : null) ??
      locations.find((item) => item.user_id === selectedMember.userId) ??
      null;
    if (!location) return null;
    return { location, member: selectedMember.member, own: selectedMember.own };
  }, [locations, ownLocation, selectedMember]);

  useEffect(() => {
    if (!mapTarget?.messageId) return;
    setHiddenLocationMessageIds((current) => {
      if (!current.has(mapTarget.messageId!)) return current;
      const next = new Set(current);
      next.delete(mapTarget.messageId!);
      return next;
    });
    setSelectedLocationMessageId(mapTarget.messageId);
  }, [mapTarget]);

  useEffect(() => {
    if (!selectedMember) return;
    const timeout = setTimeout(() => setSelectedMember(null), 5000);

    return () => clearTimeout(timeout);
  }, [selectedMember]);

  async function sendSelectedLocation() {
    if (!sendCoordinate) return;
    try {
      setSending(true);
      await onSendLocationMessage(sendText, sendCoordinate.latitude, sendCoordinate.longitude);
      closeSendModal();
      setSendText('Ses här om 20 min');
    } finally {
      setSending(false);
    }
  }

  function closeSendModal() {
    onInputFocusChange(false);
    setSendCoordinate(null);
  }

  function hideLocationMessage(messageId: string) {
    setSelectedMember(null);
    setSelectedLocationMessageId(null);
    setHiddenLocationMessageIds((current) => new Set(current).add(messageId));
  }

  const visibleLocationMessages = approved
    ? locationMessages.filter((message) => !hiddenLocationMessageIds.has(message.id))
    : [];
  const selectedLocationMessage = visibleLocationMessages.find((message) => message.id === selectedLocationMessageId) ?? null;

  return (
    <View style={styles.mapWrap}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        mapType={mapType}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onLongPress={(event) => {
          if (!approved) return;
          setSelectedMember(null);
          setSendText('Ses här om 20 min');
          setSendCoordinate(event.nativeEvent.coordinate);
        }}
        onPress={() => {
          setSelectedMember(null);
          setSelectedLocationMessageId(null);
        }}
        onRegionChangeComplete={setRegion}>
        {approved && showGroupMapOverlay && groupMapOverlay ? (
          <Overlay
            bounds={[
              [groupMapOverlay.south, groupMapOverlay.west],
              [groupMapOverlay.north, groupMapOverlay.east],
            ]}
            image={{ uri: groupMapOverlay.localImageUri }}
            opacity={0.8}
          />
        ) : null}
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
                onSelect={(selectedLocation, selectedMember, own) => {
                  setSelectedLocationMessageId(null);
                  setSelectedMember({ userId: selectedLocation.user_id, member: selectedMember, own });
                }}
                ownProfile={profile}
                userId={userId}
              />
            );
          });
        })}
        {visibleLocationMessages.map((message) => (
          <Marker
            key={message.id}
            coordinate={{ latitude: message.latitude!, longitude: message.longitude! }}
            pinColor="#111827"
            title=""
            onPress={(event) => {
              event.stopPropagation();
              setSelectedLocationMessageId(message.id);
            }}
          />
        ))}
      </MapView>
      {selectedMemberLocation ? (
        <MemberCallout
          accuracy={selectedMemberLocation.location.accuracy}
          alias={
            selectedMemberLocation.own
              ? 'Du'
              : selectedMemberLocation.member?.profiles?.alias ?? `Användare ${selectedMemberLocation.location.user_id.slice(0, 8)}`
          }
          color={
            (selectedMemberLocation.own ? profile?.symbol_color : selectedMemberLocation.member?.profiles?.symbol_color) ??
            (selectedMemberLocation.own ? '#0f8bff' : '#ef4444')
          }
          member={selectedMemberLocation.member}
          own={selectedMemberLocation.own}
          ownProfile={profile}
          updatedAt={selectedMemberLocation.location.updated_at}
        />
      ) : null}
      {selectedLocationMessage ? (
        <View style={styles.sentLocationPopup}>
          <Text style={styles.sentLocationPopupText}>{selectedLocationMessage.text || 'Skickad plats'}</Text>
          <Pressable hitSlop={8} style={styles.sentLocationClose} onPress={() => hideLocationMessage(selectedLocationMessage.id)}>
            <MaterialCommunityIcons color="#253044" name="close" size={15} />
          </Pressable>
        </View>
      ) : null}
      <Modal transparent animationType="fade" visible={Boolean(sendCoordinate)} onRequestClose={closeSendModal}>
        <Pressable style={styles.mapSendBackdrop} onPress={closeSendModal}>
          <Pressable style={styles.mapSendPopup} onPress={() => {}}>
            <View style={styles.mapSendHeader}>
              <Text style={styles.mapSendTitle}>Skicka position?</Text>
              <View style={styles.mapSendActions}>
                <Pressable hitSlop={8} style={styles.mapSendIconButton} onPress={closeSendModal}>
                  <MaterialCommunityIcons color="#253044" name="close" size={19} />
                </Pressable>
                <Pressable disabled={sending} hitSlop={8} style={[styles.mapSendIconButton, styles.mapSendSubmit, sending && styles.disabled]} onPress={sendSelectedLocation}>
                  <MaterialCommunityIcons color="#ffffff" name="send" size={18} />
                </Pressable>
              </View>
            </View>
            <TextInput
              placeholder="Ses här om 20 min"
              returnKeyType="done"
              style={styles.input}
              value={sendText}
              onChangeText={setSendText}
              onBlur={() => onInputFocusChange(false)}
              onFocus={() => onInputFocusChange(true)}
            />
          </Pressable>
        </Pressable>
      </Modal>
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
