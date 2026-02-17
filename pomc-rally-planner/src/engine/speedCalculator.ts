import { TypeCode, SpeedLookupEntry, TimeAddLookupEntry } from '../types/domain';

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

/** Default open section speeds.
 *  All groups travel at the same speed (B=C=D=A).
 *  Derived from DJ Rally OpenSect spreadsheet.
 */
const DEFAULT_OPEN_SPEEDS: Record<number, [number, number, number]> = {
  0: [0, 0, 0],
  1: [1, 1, 1],
  10: [10, 10, 10],
  20: [20, 20, 20],
  25: [25, 25, 25],
  27: [27, 27, 27],
  30: [30, 30, 30],
  35: [35, 35, 35],
  36: [36, 36, 36],
  38: [38, 38, 38],
  40: [40, 40, 40],
  42: [42, 42, 42],
};

/** Default graduated speed lookup for regularity sections.
 *  Derived from analysis of DJ Rally CSV data.
 *  Key: A-speed. Value: [B, C, D] speeds.
 */
const DEFAULT_FLAT_SPEEDS: Record<number, [number, number, number]> = {
  24: [25, 27, 29],
  25: [27, 29, 31],
  26: [28, 31, 33],
  27: [30, 32, 35],
  28: [31, 34, 37],
  29: [32, 36, 39],
  30: [34, 37, 41],
  31: [35, 39, 43],
  32: [36, 41, 45],
  33: [37, 42, 47],
  34: [39, 44, 49],
  35: [40, 46, 51],
  36: [41, 47, 52],
  37: [43, 49, 54],
  38: [44, 50, 56],
  39: [45, 52, 58],
  40: [47, 54, 60],
  41: [48, 55, 62],
  42: [49, 57, 64],
  43: [51, 59, 66],
  44: [52, 60, 68],
  45: [53, 62, 70],
  46: [55, 64, 72],
  47: [56, 65, 74],
  48: [57, 67, 76],
  49: [58, 69, 78],
  50: [60, 70, 80],
};

const DEFAULT_DOWNHILL_SPEEDS: Record<number, [number, number, number]> = {
  24: [25, 26, 28],
  25: [26, 27, 29],
  26: [27, 29, 30],
  27: [29, 30, 31],
  28: [30, 31, 32],
  29: [31, 32, 33],
  30: [32, 34, 35],
  31: [34, 36, 37],
  32: [35, 37, 39],
  33: [36, 39, 41],
  34: [37, 41, 43],
  35: [39, 42, 45],
  36: [40, 44, 47],
  37: [41, 46, 49],
  38: [43, 47, 51],
  39: [44, 49, 52],
  40: [45, 50, 54],
  41: [47, 52, 56],
  42: [48, 54, 58],
  43: [49, 55, 60],
  44: [51, 57, 62],
  45: [52, 59, 64],
  46: [53, 60, 66],
  47: [55, 62, 68],
  48: [56, 64, 70],
  49: [57, 65, 72],
  50: [58, 67, 74],
};

const DEFAULT_UPHILL_SPEEDS: Record<number, [number, number, number]> = {
  22: [24, 27, 31],
  23: [25, 29, 33],
  24: [27, 31, 35],
  25: [28, 32, 37],
  26: [30, 34, 39],
  27: [31, 36, 41],
  28: [32, 37, 43],
  29: [34, 39, 45],
  30: [35, 41, 47],
  31: [36, 42, 49],
  32: [37, 44, 51],
  33: [39, 46, 52],
  34: [40, 47, 54],
  35: [41, 49, 56],
  36: [43, 50, 58],
  37: [44, 52, 60],
  38: [45, 54, 62],
  39: [47, 55, 64],
  40: [48, 57, 66],
  41: [49, 59, 68],
  42: [51, 60, 70],
  43: [52, 62, 72],
  44: [53, 64, 74],
  45: [55, 65, 76],
  46: [56, 67, 78],
  47: [57, 69, 80],
  48: [58, 70, 80],
  49: [60, 70, 80],
  50: [60, 70, 80],
};

const DEFAULT_SPEED_LIMIT_SPEEDS: Record<number, [number, number, number]> = {
  30: [35, 40, 45],
  35: [40, 45, 50],
  40: [50, 55, 60],
  45: [55, 65, 70],
  50: [60, 70, 80],
  55: [65, 75, 90],
};

function getTerrainTable(type: TypeCode): Record<number, [number, number, number]> {
  switch (type) {
    case 'o': return DEFAULT_OPEN_SPEEDS;
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
  customTable?: SpeedLookupEntry[],
  speedLimitMarginPercent: number = 10,
): [number, number, number, number] {
  // Effective limit: e.g. 10% margin on 60 km/h limit = 54 km/h max
  const effectiveLimit = Math.floor(speedLimit * (1 - speedLimitMarginPercent / 100));

  // Time add: speed is 0
  if (type === 't') {
    return [0, 0, 0, 0];
  }

  // Marked control: inherit speeds (handled by caller)
  if (type === 'm') {
    return [aSpeed, aSpeed, aSpeed, aSpeed];
  }

  // Check custom table first (applies to all types including 'o')
  if (customTable) {
    const entry = customTable.find(e => e.type === type && e.aSpeed === aSpeed);
    if (entry) {
      return [
        Math.min(entry.aSpeed, effectiveLimit),
        Math.min(entry.bSpeed, effectiveLimit),
        Math.min(entry.cSpeed, effectiveLimit),
        Math.min(entry.dSpeed, effectiveLimit),
      ];
    }
  }

  // Default lookup
  const table = getTerrainTable(type);
  const entry = table[aSpeed];
  if (entry) {
    return [
      Math.min(aSpeed, effectiveLimit),
      Math.min(entry[0], effectiveLimit),
      Math.min(entry[1], effectiveLimit),
      Math.min(entry[2], effectiveLimit),
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
    Math.min(aSpeed, effectiveLimit),
    Math.min(Math.round(nearestEntry[0] * ratio), effectiveLimit),
    Math.min(Math.round(nearestEntry[1] * ratio), effectiveLimit),
    Math.min(Math.round(nearestEntry[2] * ratio), effectiveLimit),
  ];
}

/** Build SpeedLookupEntry array from the default tables */
export function getDefaultSpeedLookupTable(): SpeedLookupEntry[] {
  const entries: SpeedLookupEntry[] = [];
  const types: TypeCode[] = ['o', 'f', 'd', 'u', 'l'];

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

/**
 * Look up time-add B/C/D values from the time-add lookup table.
 * Exact match on addTimeA; if no match, returns [a, a, a, a].
 */
export function lookupTimeAdds(
  addTimeA: number,
  table?: TimeAddLookupEntry[],
): [number, number, number, number] {
  if (table && table.length > 0) {
    const entry = table.find(e => e.addTimeA === addTimeA);
    if (entry) {
      return [entry.addTimeA, entry.addTimeB, entry.addTimeC, entry.addTimeD];
    }
  }
  return [addTimeA, addTimeA, addTimeA, addTimeA];
}

/** Default time-add lookup table derived from DJ Rally data */
const DEFAULT_TIME_ADD_TABLE: [number, number, number, number][] = [
  [0, 0, 0, 0],
  [5, 5, 5, 5],
  [8, 10, 12, 14],
  [10, 15, 15, 20],
  [11, 11, 11, 11],
  [15, 20, 20, 25],
  [20, 25, 25, 30],
  [25, 30, 30, 35],
  [30, 35, 40, 45],
  [35, 40, 45, 50],
  [40, 45, 50, 55],
  [45, 50, 55, 60],
  [50, 55, 60, 65],
  [55, 60, 65, 70],
  [60, 65, 70, 75],
  [65, 70, 75, 80],
];

/** Build TimeAddLookupEntry array from the default table */
export function getDefaultTimeAddLookupTable(): TimeAddLookupEntry[] {
  return DEFAULT_TIME_ADD_TABLE.map(([a, b, c, d]) => ({
    addTimeA: a,
    addTimeB: b,
    addTimeC: c,
    addTimeD: d,
  }));
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
