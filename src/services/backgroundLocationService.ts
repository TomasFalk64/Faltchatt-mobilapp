import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { MAX_SEND_INTERVAL_MS, MIN_SEND_DISTANCE_METERS } from '@/constants/faltchatt';
import { requireSupabase } from '@/lib/supabase';
import { LocationRow } from '@/lib/types';
import { upsertLocation } from '@/services/locationService';

export const BACKGROUND_LOCATION_TASK = 'faltchatt-background-location';

const BACKGROUND_STATE_KEY = 'faltchatt.backgroundLocationState';
const BACKGROUND_LAST_SENT_KEY = 'faltchatt.backgroundLocationLastSent';
const BACKGROUND_APP_ACTIVE_KEY = 'faltchatt.backgroundLocationAppActive';
const BACKGROUND_TIME_INTERVAL_MS = 60 * 1000;
const BACKGROUND_DISTANCE_INTERVAL_METERS = 20;

type BackgroundLocationState = {
  activeGroupId: string | null;
  enabled: boolean;
  userId: string | null;
};

type LastSentLocation = {
  at: number;
  lat: number | null;
  lng: number | null;
};

type BackgroundTaskData = {
  locations?: Location.LocationObject[];
};

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('Background location error', error);
    return;
  }
  const state = await readBackgroundLocationState();
  if (!state.enabled || !state.activeGroupId || !state.userId) return;
  if ((await AsyncStorage.getItem(BACKGROUND_APP_ACTIVE_KEY)) === 'true') return;

  const session = await requireSupabase().auth.getSession().catch(() => null);
  if (!session?.data.session || session.data.session.user.id !== state.userId) return;

  const locations = (data as BackgroundTaskData | undefined)?.locations ?? [];
  const location = locations[locations.length - 1];
  if (!location) return;
  const row = makeLocationRow(state.activeGroupId, state.userId, location);
  if (!(await shouldSendBackgroundLocation(row))) return;
  await upsertLocation(row).catch((uploadError) => console.warn('Kunde inte dela bakgrundsposition.', uploadError));
});

export async function requestBackgroundLocationPermission() {
  const foreground = await ensureForegroundPermission();
  if (!foreground.granted) {
    return {
      granted: false,
      message: 'Platsbehörighet saknas. Aktivera position i telefonens appinställningar och slå på delning igen.',
    };
  }

  const available = await Location.isBackgroundLocationAvailableAsync();
  if (!available) {
    return {
      granted: false,
      message: 'Bakgrundsposition stöds inte i den här appmiljön. Använd en development build för att testa detta.',
    };
  }

  const permission = await Location.requestBackgroundPermissionsAsync();
  if (permission.status !== 'granted') {
    return {
      granted: false,
      message: 'Bakgrundsbehörighet saknas. Tillåt platsåtkomst hela tiden i telefonens appinställningar.',
    };
  }

  return { granted: true, message: '' };
}

export async function syncBackgroundLocationUpdates(state: BackgroundLocationState) {
  await saveBackgroundLocationState(state);
  if (!state.enabled || !state.activeGroupId || !state.userId) {
    await stopBackgroundLocationUpdates();
    return false;
  }
  const permission = await Location.getBackgroundPermissionsAsync();
  if (permission.status !== 'granted') {
    await stopBackgroundLocationUpdates();
    return false;
  }
  await startBackgroundLocationUpdates();
  return true;
}

export async function clearBackgroundLocationState() {
  await saveBackgroundLocationState({ activeGroupId: null, enabled: false, userId: null });
  await stopBackgroundLocationUpdates();
}

export async function setBackgroundLocationAppActive(active: boolean) {
  await AsyncStorage.setItem(BACKGROUND_APP_ACTIVE_KEY, String(active));
}

export function backgroundLocationSettings() {
  return {
    accuracy: 'Balanced',
    distanceIntervalMeters: BACKGROUND_DISTANCE_INTERVAL_METERS,
    timeIntervalMs: BACKGROUND_TIME_INTERVAL_MS,
    taskName: BACKGROUND_LOCATION_TASK,
  };
}

async function startBackgroundLocationUpdates() {
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) return;
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    deferredUpdatesDistance: BACKGROUND_DISTANCE_INTERVAL_METERS,
    deferredUpdatesInterval: BACKGROUND_TIME_INTERVAL_MS,
    distanceInterval: BACKGROUND_DISTANCE_INTERVAL_METERS,
    foregroundService: {
      notificationBody: 'Fältchatt delar din position med aktuell grupp',
      notificationColor: '#006d77',
      notificationTitle: 'Fältchatt',
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    timeInterval: BACKGROUND_TIME_INTERVAL_MS,
  });
}

async function stopBackgroundLocationUpdates() {
  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

async function ensureForegroundPermission() {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status === 'granted') return existing;
  return Location.requestForegroundPermissionsAsync();
}

async function readBackgroundLocationState(): Promise<BackgroundLocationState> {
  const value = await AsyncStorage.getItem(BACKGROUND_STATE_KEY);
  if (!value) return { activeGroupId: null, enabled: false, userId: null };
  return JSON.parse(value) as BackgroundLocationState;
}

async function saveBackgroundLocationState(state: BackgroundLocationState) {
  await AsyncStorage.setItem(BACKGROUND_STATE_KEY, JSON.stringify(state));
}

async function shouldSendBackgroundLocation(row: LocationRow) {
  const value = await AsyncStorage.getItem(BACKGROUND_LAST_SENT_KEY);
  const last = value ? (JSON.parse(value) as LastSentLocation) : { at: 0, lat: null, lng: null };
  const elapsed = Date.now() - last.at;
  const moved =
    last.lat === null || last.lng === null
      ? Infinity
      : distanceMeters(last.lat, last.lng, row.latitude, row.longitude);
  const shouldSend = last.lat === null || (elapsed >= BACKGROUND_TIME_INTERVAL_MS && moved > MIN_SEND_DISTANCE_METERS) || elapsed >= MAX_SEND_INTERVAL_MS;
  if (shouldSend) {
    await AsyncStorage.setItem(BACKGROUND_LAST_SENT_KEY, JSON.stringify({ at: Date.now(), lat: row.latitude, lng: row.longitude }));
  }
  return shouldSend;
}

function makeLocationRow(groupId: string, userId: string, location: Location.LocationObject): LocationRow {
  const { latitude, longitude, accuracy, heading, speed } = location.coords;
  return {
    accuracy: accuracy ?? 0,
    group_id: groupId,
    heading: Number.isFinite(heading) ? heading : null,
    latitude,
    longitude,
    speed: Number.isFinite(speed) ? speed : null,
    updated_at: new Date(location.timestamp || Date.now()).toISOString(),
    user_id: userId,
  };
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
