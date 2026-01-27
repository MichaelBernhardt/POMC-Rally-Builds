import { TypeCode, SpeedLookupEntry } from '../types/domain';

/**
 * Default speed lookup table derived from DJ Rally data.
 * Maps (terrain type, A-speed) to (A, B, C, D) graduated speeds.
 *
 * For 'o' (open) sections, all groups travel at the same speed.
 * For regularity sections (f, d, u, l), speeds are graduated A < B < C < D.
 * For 'm' (marked control), speeds inherit from surrounding row.
 * For 't' (time add), speed is 0 with addTime set.
 */

interface SpeedTableKey {
  type: TypeCode;
  aSpeed: number;
}

interface SpeedTableValue {
  bSpeed: number;
  cSpeed: number;
  dSpeed: number;
}

/** Default graduated speed lookup for regularity sections.
 *  Derived from analysis of DJ Rally CSV data.
 *  Key: A-speed. Value: [B, C, D] speeds.
 */
const DEFAULT_FLAT_SPEEDS: Record<number, [number, number, number]> = {
  20: [23, 26, 28],
  22: [25, 28, 31],
  24: [27, 31, 34],
  26: [30, 33, 37],
  28: [32, 36, 39],
  30: [34, 37, 41],
  32: [36, 40, 44],
  34: [39, 44, 49],
  35: [40, 45, 50],
  36: [40, 44, 47],
  37: [41, 46, 49],
  38: [43, 48, 53],
  40: [45, 50, 54],
  42: [49, 57, 64],
  44: [51, 57, 64],
  46: [55, 64, 72],
  48: [57, 64, 72],
  50: [57, 64, 70],
  52: [59, 66, 72],
  54: [61, 68, 75],
  56: [63, 70, 77],
  58: [65, 72, 80],
  60: [67, 74, 82],
};

const DEFAULT_DOWNHILL_SPEEDS: Record<number, [number, number, number]> = {
  20: [23, 26, 28],
  22: [25, 28, 31],
  24: [27, 31, 34],
  26: [30, 33, 37],
  28: [32, 36, 39],
  30: [34, 37, 41],
  32: [36, 40, 44],
  34: [39, 44, 49],
  35: [40, 45, 50],
  36: [40, 44, 47],
  37: [41, 46, 49],
  38: [43, 48, 53],
  40: [45, 50, 54],
  42: [49, 57, 64],
  44: [51, 57, 64],
  46: [55, 64, 72],
  48: [57, 64, 72],
  50: [57, 64, 70],
  52: [59, 66, 72],
  54: [61, 68, 75],
  56: [63, 70, 77],
  58: [65, 72, 80],
  60: [67, 74, 82],
};

const DEFAULT_UPHILL_SPEEDS: Record<number, [number, number, number]> = {
  20: [23, 26, 28],
  22: [25, 28, 31],
  24: [27, 31, 34],
  26: [30, 33, 37],
  28: [32, 36, 39],
  30: [34, 37, 41],
  32: [36, 40, 44],
  34: [39, 44, 49],
  35: [40, 45, 50],
  36: [40, 44, 47],
  37: [41, 46, 49],
  38: [43, 48, 53],
  40: [45, 50, 54],
  42: [49, 57, 64],
  44: [51, 57, 64],
  46: [55, 64, 72],
  48: [57, 64, 72],
  50: [57, 64, 70],
};

const DEFAULT_SPEED_LIMIT_SPEEDS: Record<number, [number, number, number]> = {
  20: [23, 26, 28],
  22: [25, 28, 31],
  24: [27, 31, 34],
  26: [30, 33, 37],
  28: [32, 36, 39],
  30: [34, 37, 41],
  32: [36, 40, 44],
  34: [39, 44, 49],
  35: [40, 45, 50],
  36: [40, 44, 47],
  37: [41, 46, 49],
  38: [43, 48, 53],
  40: [45, 50, 54],
  42: [49, 57, 64],
  44: [51, 57, 64],
  46: [55, 64, 72],
  48: [57, 64, 72],
  50: [57, 64, 70],
};

function getTerrainTable(type: TypeCode): Record<number, [number, number, number]> {
  switch (type) {
    case 'f': return DEFAULT_FLAT_SPEEDS;
    case 'd': return DEFAULT_DOWNHILL_SPEEDS;
    case 'u': return DEFAULT_UPHILL_SPEEDS;
    case 'l': return DEFAULT_SPEED_LIMIT_SPEEDS;
    default: return {};
  }
}

/**
 * Look up graduated speeds for a given type code and A-speed.
 * Returns [aSpeed, bSpeed, cSpeed, dSpeed].
 */
export function lookupSpeeds(
  type: TypeCode,
  aSpeed: number,
  speedLimit: number,
  customTable?: SpeedLookupEntry[]
): [number, number, number, number] {
  // Open sections: all groups same speed
  if (type === 'o') {
    const capped = Math.min(aSpeed, speedLimit);
    return [capped, capped, capped, capped];
  }

  // Time add: speed is 0
  if (type === 't') {
    return [0, 0, 0, 0];
  }

  // Marked control: inherit speeds (handled by caller)
  if (type === 'm') {
    return [aSpeed, aSpeed, aSpeed, aSpeed];
  }

  // Check custom table first
  if (customTable) {
    const entry = customTable.find(e => e.type === type && e.aSpeed === aSpeed);
    if (entry) {
      return [
        Math.min(entry.aSpeed, speedLimit),
        Math.min(entry.bSpeed, speedLimit),
        Math.min(entry.cSpeed, speedLimit),
        Math.min(entry.dSpeed, speedLimit),
      ];
    }
  }

  // Default lookup
  const table = getTerrainTable(type);
  const entry = table[aSpeed];
  if (entry) {
    return [
      Math.min(aSpeed, speedLimit),
      Math.min(entry[0], speedLimit),
      Math.min(entry[1], speedLimit),
      Math.min(entry[2], speedLimit),
    ];
  }

  // Fallback: find nearest A-speed in table
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (keys.length === 0) {
    return [aSpeed, aSpeed, aSpeed, aSpeed];
  }

  let nearest = keys[0];
  let minDiff = Math.abs(aSpeed - keys[0]);
  for (const k of keys) {
    const diff = Math.abs(aSpeed - k);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = k;
    }
  }

  const nearestEntry = table[nearest];
  // Scale proportionally
  const ratio = aSpeed / nearest;
  return [
    Math.min(aSpeed, speedLimit),
    Math.min(Math.round(nearestEntry[0] * ratio), speedLimit),
    Math.min(Math.round(nearestEntry[1] * ratio), speedLimit),
    Math.min(Math.round(nearestEntry[2] * ratio), speedLimit),
  ];
}

/** Build SpeedLookupEntry array from the default tables */
export function getDefaultSpeedLookupTable(): SpeedLookupEntry[] {
  const entries: SpeedLookupEntry[] = [];
  const types: TypeCode[] = ['f', 'd', 'u', 'l'];

  for (const type of types) {
    const table = getTerrainTable(type);
    for (const [aStr, [b, c, d]] of Object.entries(table)) {
      entries.push({
        terrain: type,
        type,
        aSpeed: Number(aStr),
        bSpeed: b,
        cSpeed: c,
        dSpeed: d,
      });
    }
  }

  return entries;
}

/** Find the nearest matching lookup table key */
export function findNearestKey(table: Record<string, SpeedTableKey & SpeedTableValue>, aSpeed: number): string | null {
  const keys = Object.keys(table).map(Number);
  if (keys.length === 0) return null;

  let nearest = keys[0];
  let minDiff = Math.abs(aSpeed - keys[0]);
  for (const k of keys) {
    const diff = Math.abs(aSpeed - k);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = k;
    }
  }
  return String(nearest);
}
