import { RouteRow, SpeedLookupEntry, SpeedGroupSettings, TypeCode } from '../types/domain';
import { lookupSpeeds } from './speedCalculator';

/**
 * Parse a time string "HH:MM:SS" into fractional hours.
 */
export function parseTimeToHours(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 3) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const s = parseInt(parts[2], 10) || 0;
  return h + m / 60 + s / 3600;
}

/**
 * Format fractional hours into "HH:MM:SS".
 */
export function formatHoursToTime(hours: number): string {
  if (!isFinite(hours) || hours < 0) return '00:00:00';
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Recalculate B/C/D speeds from type code, A-speed, and speed lookup table.
 * Only updates rows that have a type code and a positive A-speed.
 * For 'm' (marked control) rows, inherits speeds from the previous regularity row.
 */
export function recalculateSpeeds(
  rows: RouteRow[],
  customTable?: SpeedLookupEntry[],
): RouteRow[] {
  let lastRegularitySpeeds: [number, number, number, number] | null = null;

  return rows.map(row => {
    if (!row.type || row.type === 't') {
      // Time-add rows: speeds are 0
      if (row.type === 't') {
        return { ...row, aSpeed: 0, bSpeed: 0, cSpeed: 0, dSpeed: 0 };
      }
      return row;
    }

    if (row.type === 'm') {
      // Marked control: inherit from last regularity row's speeds
      if (lastRegularitySpeeds) {
        return {
          ...row,
          aSpeed: lastRegularitySpeeds[0],
          bSpeed: lastRegularitySpeeds[1],
          cSpeed: lastRegularitySpeeds[2],
          dSpeed: lastRegularitySpeeds[3],
        };
      }
      return row;
    }

    if (row.aSpeed > 0) {
      const [a, b, c, d] = lookupSpeeds(row.type, row.aSpeed, row.speedLimit, customTable);
      lastRegularitySpeeds = [a, b, c, d];
      return { ...row, aSpeed: a, bSpeed: b, cSpeed: c, dSpeed: d };
    }

    return row;
  });
}

/**
 * Compute the start offset (in seconds) of the last car in group D,
 * accounting for per-group car counts, intervals, and inter-group gaps.
 */
export function computeLastCarOffsetSeconds(sgs: SpeedGroupSettings): number {
  // Group A: cars 0..(a.numberOfCars-1)
  const aLastSec = Math.max(0, sgs.a.numberOfCars - 1) * sgs.a.carIntervalSeconds;
  // Group B first car starts after A last car + gap
  const bFirstSec = aLastSec + sgs.gapABSeconds;
  const bLastSec = bFirstSec + Math.max(0, sgs.b.numberOfCars - 1) * sgs.b.carIntervalSeconds;
  // Group C
  const cFirstSec = bLastSec + sgs.gapBCSeconds;
  const cLastSec = cFirstSec + Math.max(0, sgs.c.numberOfCars - 1) * sgs.c.carIntervalSeconds;
  // Group D
  const dFirstSec = cLastSec + sgs.gapCDSeconds;
  const dLastSec = dFirstSec + Math.max(0, sgs.d.numberOfCars - 1) * sgs.d.carIntervalSeconds;
  return dLastSec;
}

/**
 * Compute cumulative times for all rows in a day.
 *
 * Convention: the segment between rows N-1 and N is traveled at row N-1's speed.
 *
 * For each row i (starting from i=1):
 *   segment_distance = row[i].distance - row[i-1].distance
 *   If row[i].type == 't':
 *     cumulative_time += addTime / 60 (minutes to hours)
 *   Else if segment_distance > 0 AND previous_speed > 0:
 *     cumulative_time += segment_distance / previous_speed
 *
 * First car = group A first car (offset 0) using A-speed timing.
 * Last car = group D last car using D-speed timing.
 *
 * @param rows - The route rows
 * @param startTime - Start time as "HH:MM:SS"
 * @param speedGroupSettings - Per-group car settings
 * @returns Updated rows with firstCarTime and lastCarTime filled in
 */
export function computeTimes(
  rows: RouteRow[],
  startTime: string,
  speedGroupSettings: SpeedGroupSettings,
): RouteRow[] {
  if (rows.length === 0) return [];

  const startHours = parseTimeToHours(startTime);
  const lastCarOffsetHours = computeLastCarOffsetSeconds(speedGroupSettings) / 3600;

  let cumulativeTimeA = 0;
  let cumulativeTimeB = 0;
  let cumulativeTimeC = 0;
  let cumulativeTimeD = 0;

  const result = rows.map((row, i) => {
    if (i > 0) {
      const segmentDist = row.rallyDistance - rows[i - 1].rallyDistance;
      const prevRow = rows[i - 1];

      if (row.type === 't') {
        cumulativeTimeA += row.addTimeA / 60;
        cumulativeTimeB += row.addTimeB / 60;
        cumulativeTimeC += row.addTimeC / 60;
        cumulativeTimeD += row.addTimeD / 60;
      } else if (segmentDist > 0) {
        if (prevRow.aSpeed > 0) cumulativeTimeA += segmentDist / prevRow.aSpeed;
        if (prevRow.bSpeed > 0) cumulativeTimeB += segmentDist / prevRow.bSpeed;
        if (prevRow.cSpeed > 0) cumulativeTimeC += segmentDist / prevRow.cSpeed;
        if (prevRow.dSpeed > 0) cumulativeTimeD += segmentDist / prevRow.dSpeed;
      }
    }

    // First car = group A first car (offset 0) + A-speed cumulative
    const firstArrival = startHours + cumulativeTimeA;
    // Last car = group D last car offset + D-speed cumulative
    const lastArrival = startHours + lastCarOffsetHours + cumulativeTimeD;

    return {
      ...row,
      firstCarTime: formatHoursToTime(firstArrival),
      lastCarTime: formatHoursToTime(lastArrival),
    };
  });

  return result;
}

/**
 * Compute cumulative time for a specific speed group.
 * Returns array of cumulative hours for each row.
 */
export function computeCumulativeForGroup(
  rows: RouteRow[],
  speedGroup: 'a' | 'b' | 'c' | 'd',
): number[] {
  const getSpeed = (row: RouteRow): number => {
    switch (speedGroup) {
      case 'a': return row.aSpeed;
      case 'b': return row.bSpeed;
      case 'c': return row.cSpeed;
      case 'd': return row.dSpeed;
    }
  };

  const getAddTime = (row: RouteRow): number => {
    switch (speedGroup) {
      case 'a': return row.addTimeA;
      case 'b': return row.addTimeB;
      case 'c': return row.addTimeC;
      case 'd': return row.addTimeD;
    }
  };

  const times: number[] = [];
  let cumulative = 0;

  for (let i = 0; i < rows.length; i++) {
    if (i > 0) {
      const segmentDist = rows[i].rallyDistance - rows[i - 1].rallyDistance;

      if (rows[i].type === 't') {
        cumulative += getAddTime(rows[i]) / 60;
      } else if (segmentDist > 0) {
        const prevSpeed = getSpeed(rows[i - 1]);
        if (prevSpeed > 0) {
          cumulative += segmentDist / prevSpeed;
        }
      }
    }
    times.push(cumulative);
  }

  return times;
}
