import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromByteArray } from 'base64-js';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import proj4 from 'proj4';
import UPNG from 'upng-js';
import * as UTIF from 'utif';

import { requireSupabase } from '@/lib/supabase';
import { Group } from '@/lib/types';

const GROUP_MAPS_BUCKET = 'group-maps';
const MAP_CACHE_PREFIX = 'faltchatt.groupMapCache';
const MAP_CACHE_DIR = new Directory(Paths.document, 'faltchatt-maps');
const MAX_MAP_SIDE = 1000;
const WEB_MERCATOR_DEF =
  '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs';
const SWEREF99_TM_DEF =
  '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
const ROTATION_EPSILON = 1e-9;

proj4.defs('EPSG:3857', WEB_MERCATOR_DEF);
proj4.defs('EPSG:3006', SWEREF99_TM_DEF);

export type GroupMapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type GroupMapOverlay = GroupMapBounds & {
  displayName: string;
  imagePath: string;
  imageVersion: string;
  localImageUri: string;
};

export type GroupMapCache = GroupMapOverlay & {
  cachedAt: string;
  groupId: string;
};

type DecodedGeoTiff = {
  buffer: ArrayBuffer;
  ifd: Record<string, unknown>;
};

type GeoTiffMetadata = {
  bounds: GroupMapBounds;
  sourceEpsg: number;
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

export async function uploadConvertedGroupMap(group: Group, asset: DocumentPicker.DocumentPickerAsset) {
  const previousPath = group.map_image_path ?? null;
  const previousCache = await loadGroupMapCache(group.id);
  const converted = await convertGeoTiffToPng(asset.uri, asset.name);
  const version = new Date().toISOString().replace(/[^0-9]/g, '');
  const imagePath = `${group.id}/map-${version}.png`;
  const client = requireSupabase();
  const uploadBody = await readPngUploadBody(converted.localImageUri);
  console.log('[group-map] local PNG before upload', {
    bytes: uploadBody.byteLength,
    height: converted.height,
    path: imagePath,
    type: uploadBody.bodyType,
    uri: converted.localImageUri,
    width: converted.width,
  });
  if (uploadBody.byteLength <= 0) {
    throw new Error('PNG-filen blev 0 bytes och laddades inte upp.');
  }

  const { error: uploadError } = await client.storage.from(GROUP_MAPS_BUCKET).upload(imagePath, uploadBody.body, {
    cacheControl: '31536000',
    contentType: 'image/png',
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const uploadedSize = await getUploadedObjectSize(imagePath);
  console.log('[group-map] uploaded PNG after upload', {
    bytes: uploadedSize,
    path: imagePath,
  });
  if (uploadedSize === 0) {
    await client.storage.from(GROUP_MAPS_BUCKET).remove([imagePath]).catch(() => {});
    throw new Error('Den uppladdade PNG-filen blev 0 bytes och kartan sparades inte.');
  }

  const patch = {
    map_file_path: null,
    map_image_path: imagePath,
    map_image_version: version,
    map_north: converted.bounds.north,
    map_south: converted.bounds.south,
    map_east: converted.bounds.east,
    map_west: converted.bounds.west,
    map_original_filename: asset.name,
    map_updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await client.from('groups').update(patch).eq('id', group.id);
  if (updateError) throw updateError;

  if (previousPath && previousPath !== imagePath) {
    client.storage.from(GROUP_MAPS_BUCKET).remove([previousPath]).catch(() => {});
  }
  if (previousCache?.localImageUri && previousCache.localImageUri !== converted.localImageUri && new File(previousCache.localImageUri).exists) {
    new File(previousCache.localImageUri).delete();
  }

  return saveGroupMapCache({
    cachedAt: new Date().toISOString(),
    displayName: asset.name,
    groupId: group.id,
    imagePath,
    imageVersion: version,
    localImageUri: converted.localImageUri,
    ...converted.bounds,
  });
}

export async function syncGroupMapCache(group: Group) {
  const current = await loadGroupMapCache(group.id);
  const imagePath = group.map_image_path ?? null;
  const imageVersion = group.map_image_version ?? imagePath ?? null;
  const bounds = groupBounds(group);

  if (!imagePath || !imageVersion || !bounds) {
    await clearGroupMapCache(group.id);
    return null;
  }

  if (current?.imagePath === imagePath && current.imageVersion === imageVersion && new File(current.localImageUri).exists) {
    return current;
  }

  if (current?.localImageUri && new File(current.localImageUri).exists) {
    new File(current.localImageUri).delete();
  }

  const localImageUri = await downloadGroupMapImage(group.id, imagePath, imageVersion);
  return saveGroupMapCache({
    cachedAt: new Date().toISOString(),
    displayName: group.map_original_filename ?? displayMapName(imagePath),
    groupId: group.id,
    imagePath,
    imageVersion,
    localImageUri,
    ...bounds,
  });
}

export async function loadGroupMapCache(groupId: string) {
  const value = await AsyncStorage.getItem(mapCacheKey(groupId));
  return value ? (JSON.parse(value) as GroupMapCache) : null;
}

async function convertGeoTiffToPng(geoTiffUri: string, originalName: string) {
  const decoded = await readGeoTiff(geoTiffUri);
  if (!decoded) throw new Error('GeoTIFF-kartan kunde inte läsas.');
  const metadata = extractGeoTiffMetadata(decoded.ifd);
  if (!metadata) throw new Error('GeoTIFF-kartan saknar georeferering eller stödd projektion.');

  UTIF.decodeImage(decoded.buffer, decoded.ifd);
  const rgba = UTIF.toRGBA8(decoded.ifd);
  const srcW = Number(decoded.ifd.width ?? decoded.ifd.t256 ?? 0);
  const srcH = Number(decoded.ifd.height ?? decoded.ifd.t257 ?? 0);
  if (srcW <= 0 || srcH <= 0 || !rgba?.length) throw new Error('GeoTIFF-kartan kunde inte konverteras till bild.');

  const { width, height } = fitSize(srcW, srcH, MAX_MAP_SIDE);
  const scaled = resizeRgbaNearest(rgba, srcW, srcH, width, height);
  const pngArrayBuffer = UPNG.encode([toArrayBuffer(scaled)], width, height, 0);
  MAP_CACHE_DIR.create({ idempotent: true, intermediates: true });
  const localImageUri = new File(MAP_CACHE_DIR, `${Date.now()}-${safeMapName(originalName)}.png`).uri;
  new File(localImageUri).write(fromByteArray(new Uint8Array(pngArrayBuffer)), { encoding: 'base64' });

  return {
    bounds: metadata.bounds,
    height,
    localImageUri,
    sourceEpsg: metadata.sourceEpsg,
    width,
  };
}

async function readGeoTiff(geoTiffUri: string): Promise<DecodedGeoTiff | null> {
  try {
    const bytes = await new File(geoTiffUri).bytes();
    const buffer = toArrayBuffer(bytes);
    const ifds = UTIF.decode(buffer);
    if (!ifds.length) return null;
    return { buffer, ifd: ifds[0] as Record<string, unknown> };
  } catch {
    return null;
  }
}

async function readPngUploadBody(localImageUri: string) {
  const bytes = await new File(localImageUri).bytes();
  if (bytes.byteLength <= 0) {
    return { body: toArrayBuffer(bytes), bodyType: 'ArrayBuffer' as const, byteLength: 0 };
  }
  const body = toArrayBuffer(bytes);
  return { body, bodyType: 'ArrayBuffer' as const, byteLength: body.byteLength };
}

async function getUploadedObjectSize(imagePath: string) {
  const storage = requireSupabase().storage.from(GROUP_MAPS_BUCKET);
  const { data: infoData, error: infoError } = await storage.info(imagePath);
  if (!infoError && typeof infoData?.size === 'number') return infoData.size;

  const pathParts = imagePath.split('/');
  const fileName = pathParts.pop();
  if (!fileName) return null;
  const folder = pathParts.join('/');
  const { data: listData, error: listError } = await storage.list(folder, { limit: 100, search: fileName });
  if (listError) return null;
  const file = listData?.find((item) => item.name === fileName);
  const size = file?.metadata?.size;
  return typeof size === 'number' ? size : null;
}

function extractGeoTiffMetadata(ifd: Record<string, unknown>): GeoTiffMetadata | null {
  const width = Number(ifd.width ?? ifd.t256 ?? 0);
  const height = Number(ifd.height ?? ifd.t257 ?? 0);
  if (width <= 0 || height <= 0) return null;

  const pixelToSource = makePixelToSourceTransform(ifd, width, height);
  if (!pixelToSource) return null;
  const sourceEpsg = extractGeoEpsg(ifd);
  if (!sourceEpsg) return null;

  const cornersWgs84 = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: height },
    { x: width, y: height },
  ]
    .map((point) => pixelToSource(point.x, point.y))
    .map((point) => projectToWgs84(`EPSG:${sourceEpsg}`, point.x, point.y))
    .filter((point): point is { latitude: number; longitude: number } => Boolean(point));

  if (cornersWgs84.length < 4) return null;
  const latitudes = cornersWgs84.map((point) => point.latitude);
  const longitudes = cornersWgs84.map((point) => point.longitude);
  const bounds = {
    north: Math.max(...latitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    west: Math.min(...longitudes),
  };

  return isValidBounds(bounds) ? { bounds, sourceEpsg } : null;
}

function makePixelToSourceTransform(
  ifd: Record<string, unknown>,
  width: number,
  height: number,
): ((x: number, y: number) => { x: number; y: number }) | null {
  const matrix = asNumberArray(ifd.t34264 ?? ifd.ModelTransformationTag);
  if (matrix && matrix.length >= 16) {
    if (Math.abs(matrix[1]) > ROTATION_EPSILON || Math.abs(matrix[4]) > ROTATION_EPSILON) {
      throw new Error('Den här kartan är roterad eller skevad och stöds inte ännu.');
    }
    return (x: number, y: number) => ({
      x: matrix[0] * x + matrix[3],
      y: matrix[5] * y + matrix[7],
    });
  }

  const scales = asNumberArray(ifd.t33550 ?? ifd.ModelPixelScaleTag);
  const tie = asNumberArray(ifd.t33922 ?? ifd.ModelTiepointTag);
  if (!scales || scales.length < 2 || !tie || tie.length < 6) return null;
  const scaleX = scales[0];
  const scaleY = scales[1];

  for (let index = 0; index + 5 < tie.length; index += 6) {
    const tieI = tie[index];
    const tieJ = tie[index + 1];
    const tieX = tie[index + 3];
    const tieY = tie[index + 4];
    const candidate = (x: number, y: number) => ({
      x: tieX + (x - tieI) * scaleX,
      y: tieY - (y - tieJ) * scaleY,
    });
    const start = candidate(0, 0);
    const end = candidate(width, height);
    if (Math.abs(end.x - start.x) > 0 && Math.abs(end.y - start.y) > 0) return candidate;
  }

  return null;
}

function extractGeoEpsg(ifd: Record<string, unknown>) {
  const geoKeys = asNumberArray(ifd.t34735 ?? ifd.GeoKeyDirectoryTag);
  if (!geoKeys || geoKeys.length < 8) return null;

  const entryCount = Math.floor((geoKeys.length - 4) / 4);
  for (let index = 0; index < entryCount; index += 1) {
    const base = 4 + index * 4;
    const keyId = geoKeys[base];
    const tiffTagLocation = geoKeys[base + 1];
    const valueOffset = geoKeys[base + 3];
    if (tiffTagLocation !== 0) continue;
    if (keyId === 3072 || keyId === 2048) return valueOffset;
  }
  return null;
}

function projectToWgs84(sourceCrs: string, x: number, y: number) {
  try {
    if (sourceCrs === 'EPSG:4326') return { longitude: x, latitude: y };
    const [longitude, latitude] = proj4(sourceCrs, 'EPSG:4326', [x, y]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    return { longitude, latitude };
  } catch {
    return null;
  }
}

async function downloadGroupMapImage(groupId: string, imagePath: string, imageVersion: string) {
  MAP_CACHE_DIR.create({ idempotent: true, intermediates: true });
  const target = new File(MAP_CACHE_DIR, `${groupId}-${safeMapName(imageVersion)}.png`);
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
  const current = await loadGroupMapCache(groupId);
  if (current?.localImageUri && new File(current.localImageUri).exists) {
    new File(current.localImageUri).delete();
  }
  await AsyncStorage.removeItem(mapCacheKey(groupId));
}

function groupBounds(group: Group): GroupMapBounds | null {
  const north = group.map_north;
  const south = group.map_south;
  const east = group.map_east;
  const west = group.map_west;
  if (
    typeof north !== 'number' ||
    typeof south !== 'number' ||
    typeof east !== 'number' ||
    typeof west !== 'number'
  ) {
    return null;
  }
  const bounds = { north, south, east, west };
  return isValidBounds(bounds) ? bounds : null;
}

function mapCacheKey(groupId: string) {
  return `${MAP_CACHE_PREFIX}.${groupId}`;
}

function displayMapName(path: string) {
  const fileName = path.split('/').pop() ?? path;
  return fileName.replace(/^map-[0-9]+-?/, '') || 'Karta';
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

function fitSize(width: number, height: number, maxSide: number) {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function resizeRgbaNearest(src: Uint8Array, srcW: number, srcH: number, dstW: number, dstH: number) {
  if (srcW === dstW && srcH === dstH) return src;
  const dst = new Uint8Array(dstW * dstH * 4);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y += 1) {
    const sy = Math.min(srcH - 1, Math.floor(y * yRatio));
    for (let x = 0; x < dstW; x += 1) {
      const sx = Math.min(srcW - 1, Math.floor(x * xRatio));
      const srcIndex = (sy * srcW + sx) * 4;
      const dstIndex = (y * dstW + x) * 4;
      dst[dstIndex] = src[srcIndex];
      dst[dstIndex + 1] = src[srcIndex + 1];
      dst[dstIndex + 2] = src[srcIndex + 2];
      dst[dstIndex + 3] = src[srcIndex + 3];
    }
  }
  return dst;
}

function asNumberArray(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.map(Number);
  if (
    value instanceof Float32Array ||
    value instanceof Float64Array ||
    value instanceof Uint8Array ||
    value instanceof Uint16Array ||
    value instanceof Uint32Array ||
    value instanceof Int16Array ||
    value instanceof Int32Array
  ) {
    return Array.from(value, Number);
  }
  return null;
}

function isValidBounds(bounds: GroupMapBounds) {
  if (
    !Number.isFinite(bounds.north) ||
    !Number.isFinite(bounds.south) ||
    !Number.isFinite(bounds.east) ||
    !Number.isFinite(bounds.west)
  ) {
    return false;
  }
  if (bounds.south >= bounds.north || bounds.west >= bounds.east) return false;
  if (bounds.south < -90 || bounds.north > 90 || bounds.west < -180 || bounds.east > 180) return false;
  return true;
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
