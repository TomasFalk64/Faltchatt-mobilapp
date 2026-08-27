export function formatRelative(value?: string | null) {
  if (!value) return 'okänd tid';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s sedan`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min sedan`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h sedan`;
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'okänd tid';
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function friendlyError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
    if (code === 'invalid_credentials' || error.message.toLowerCase().includes('invalid login credentials')) return 'Okänd användare eller fel lösenord.';
    if (error.message.includes('invalid or expired join code')) return 'Gruppkoden finns inte eller gruppen har gått ut.';
    if (error.message.includes('group member limit reached')) return 'Gruppen är full. Max 30 personer kan vara pending eller approved.';
    if (error.message.includes('max active groups reached')) return 'Max 30 pågående grupper finns redan.';
    if (error.message.includes('not a member')) return 'Du behöver vara godkänd medlem i gruppen.';
    return error.message;
  }
  return fallback;
}

export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const startLat = toRad(aLat);
  const endLat = toRad(bLat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function groupExpired(expiresAt?: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}
