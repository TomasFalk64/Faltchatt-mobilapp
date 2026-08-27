export const SYMBOLS = [
  { id: 'hat', label: 'Hatt', glyph: '🎩' },
  { id: 'tree', label: 'Träd', glyph: '🌲' },
  { id: 'leaf', label: 'Löv', glyph: '🍃' },
  { id: 'mushroom', label: 'Svamp', glyph: '🍄' },
  { id: 'star', label: 'Stjärna', glyph: '★' },
  { id: 'spade', label: 'Spader', glyph: '♠' },
  { id: 'heart', label: 'Hjärta', glyph: '♥' },
  { id: 'train', label: 'Tåg', glyph: '🚆' },
  { id: 'car', label: 'Bil', glyph: '🚗' },
] as const;

export const SYMBOL_COLORS = [
  '#f70404',
  '#ff52a8',
  '#fcf700',
  '#92400e',
  '#03c74b',
  '#00fcde',
  '#044be6',
  '#9063fa',
  '#9ca3af',
  '#111827',
];

export const ACTIVE_LOCATION_MS = 15 * 60 * 1000;
export const HIDDEN_LOCATION_MS = 60 * 60 * 1000;
export const ACTIVE_PRESENCE_MS = 45 * 1000;
export const MIN_SEND_INTERVAL_MS = 20 * 1000;
export const MAX_SEND_INTERVAL_MS = 60 * 1000;
export const MIN_SEND_DISTANCE_METERS = 8;

export function symbolGlyph(symbol?: string | null) {
  return SYMBOLS.find((item) => item.id === symbol)?.glyph ?? SYMBOLS[0].glyph;
}

export function symbolLabel(symbol?: string | null) {
  return SYMBOLS.find((item) => item.id === symbol)?.label ?? SYMBOLS[0].label;
}
