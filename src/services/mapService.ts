import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

import { requireSupabase } from '@/lib/supabase';
import { Group } from '@/lib/types';

const GROUP_MAPS_BUCKET = 'group-maps';
const MAP_CACHE_PREFIX = 'faltchatt.groupMapCache';
const MAP_CACHE_DIR = new Directory(Paths.document, 'faltchatt-maps');

export type GroupMapCache = {
  cachedAt: string;
  displayName: string;
  groupId: string;
  imagePath: string | null;
  imageVersion: string | null;
  localImageUri: string | null;
  originalPath: string | null;
};

export async function pickGeoTiff() {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ['image/tiff', 'image/geotiff', 'application/octet-stream'],
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || !/\.(tif|tiff)$/i.test(asset.name)) {
    throw new Error('Välj en GeoTIFF-fil med filändelsen .tif eller .tiff.');
  }
  return asset;
}

export async function uploadGroupGeoTiff(groupId: string, asset: DocumentPicker.DocumentPickerAsset) {
  const extension = asset.name.toLowerCase().endsWith('.tiff') ? 'tiff' : 'tif';
  const safeName = safeMapName(asset.name);
  const path = `${groupId}/${Date.now()}-${safeName}.${extension}`;
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const client = requireSupabase();
  const { error: uploadError } = await client.storage.from(GROUP_MAPS_BUCKET).upload(path, blob, {
    cacheControl: '3600',
    contentType: asset.mimeType || 'image/tiff',
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { error: updateError } = await client.from('groups').update({ map_file_path: path }).eq('id', groupId);
  if (updateError) throw updateError;

  const cache = await saveGroupMapCache({
    cachedAt: new Date().toISOString(),
    displayName: asset.name,
    groupId,
    imagePath: null,
    imageVersion: null,
    localImageUri: null,
    originalPath: path,
  });
  return cache;
}

export async function syncGroupMapCache(group: Group) {
  const current = await loadGroupMapCache(group.id);
  const imagePath = group.map_image_path ?? null;
  const imageVersion = group.map_image_version ?? imagePath ?? null;
  const originalPath = group.map_file_path ?? current?.originalPath ?? null;
  const displayName = displayMapName(originalPath ?? current?.displayName ?? '');

  if (!originalPath && !imagePath) {
    await clearGroupMapCache(group.id);
    return null;
  }

  if (!imagePath) {
    return saveGroupMapCache({
      cachedAt: current?.cachedAt ?? new Date().toISOString(),
      displayName,
      groupId: group.id,
      imagePath: null,
      imageVersion: null,
      localImageUri: null,
      originalPath,
    });
  }

  if (current?.imagePath === imagePath && current.imageVersion === imageVersion && current.localImageUri) {
    if (new File(current.localImageUri).exists) return current;
  }

  const localImageUri = await downloadGroupMapImage(group.id, imagePath, imageVersion);
  return saveGroupMapCache({
    cachedAt: new Date().toISOString(),
    displayName,
    groupId: group.id,
    imagePath,
    imageVersion,
    localImageUri,
    originalPath,
  });
}

export async function loadGroupMapCache(groupId: string) {
  const value = await AsyncStorage.getItem(mapCacheKey(groupId));
  return value ? (JSON.parse(value) as GroupMapCache) : null;
}

async function downloadGroupMapImage(groupId: string, imagePath: string, imageVersion: string | null) {
  MAP_CACHE_DIR.create({ idempotent: true, intermediates: true });
  const extension = imagePath.toLowerCase().endsWith('.jpg') || imagePath.toLowerCase().endsWith('.jpeg') ? 'jpg' : 'png';
  const target = new File(MAP_CACHE_DIR, `${groupId}-${safeMapName(imageVersion ?? imagePath)}.${extension}`);
  const { data, error } = await requireSupabase().storage.from(GROUP_MAPS_BUCKET).createSignedUrl(imagePath, 60 * 60);
  if (error) throw error;
  const file = await File.downloadFileAsync(data.signedUrl, target, { idempotent: true });
  return file.uri;
}

async function saveGroupMapCache(cache: GroupMapCache) {
  await AsyncStorage.setItem(mapCacheKey(cache.groupId), JSON.stringify(cache));
  return cache;
}

async function clearGroupMapCache(groupId: string) {
  await AsyncStorage.removeItem(mapCacheKey(groupId));
}

function mapCacheKey(groupId: string) {
  return `${MAP_CACHE_PREFIX}.${groupId}`;
}

function displayMapName(path: string) {
  const fileName = path.split('/').pop() ?? path;
  return fileName.replace(/^\d+-/, '') || 'Karta';
}

function safeMapName(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42) || 'karta'
  );
}
