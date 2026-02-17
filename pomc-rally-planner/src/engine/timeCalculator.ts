import { RouteRow, SpeedLookupEntry, SpeedGroupSettings, TimeAddLookupEntry } from '../types/domain';
import { lookupSpeeds, lookupTimeAdds } from './speedCalculator';

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
  timeAddTable?: TimeAddLookupEntry[],
  speedLimitMarginPercent: number = 10,
): RouteRow[] {
  let lastRegularitySpeeds: [number, number, number, number] | null = null;

  return rows.map(row => {
    if (row.type === 't') {
      // Time-add rows: speeds are 0, look up B/C/D add-times from table
      if (row.addTimeA > 0 && timeAddTable && timeAddTable.length > 0) {
        const [a, b, c, d] = lookupTimeAdds(row.addTimeA, timeAddTable);
        return { ...row, aSpeed: 0, bSpeed: 0, cSpeed: 0, dSpeed: 0, addTimeA: a, addTimeB: b, addTimeC: c, addTimeD: d };
      }
      return { ...row, aSpeed: 0, bSpeed: 0, cSpeed: 0, dSpeed: 0 };
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

    if (row.type && row.aSpeed > 0) {
      // Row with a type code: look up speeds from the table
      const [a, b, c, d] = lookupSpeeds(row.type, row.aSpeed, row.speedLimit, customTable, speedLimitMarginPercent);
      lastRegularitySpeeds = [a, b, c, d];
      return { ...row, aSpeed: a, bSpeed: b, cSpeed: c, dSpeed: d };
    }

    if (!row.type && lastRegularitySpeeds) {
      // No type code: inherit speeds from the last typed row
      return {
        ...row,
        aSpeed: lastRegularitySpeeds[0],
        bSpeed: lastRegularitySpeeds[1],
        cSpeed: lastRegularitySpeeds[2],
        dSpeed: lastRegularitySpeeds[3],
      };
    }

    return row;
  });
}

/**
 * Compute the start time offsets (fractional hours from midnight) for all 8 time streams.
 * Returns [firstA, lastA, firstB, lastB, firstC, lastC, firstD, lastD].
 *
 * Each group's first car departs at the previous group's last car time + inter-group gap.
 * Each group's last car departs at first car + (numberOfCars - 1) * carInterval.
 */
export function computeGroupStartTimes(
  startTime: string,
  sgs: SpeedGroupSettings,
): [number, number, number, number, number, number, number, number] {
  const start = parseTimeToHours(startTime);

  const firstA = start;
  const lastA = start + Math.max(0, sgs.a.numberOfCars - 1) * sgs.a.carIntervalSeconds / 3600;

  const firstB = lastA + sgs.gapABSeconds / 3600;
  const lastB = firstB + Math.max(0, sgs.b.numberOfCars - 1) * sgs.b.carIntervalSeconds / 3600;

  const firstC = lastB + sgs.gapBCSeconds / 3600;
  const lastC = firstC + Math.max(0, sgs.c.numberOfCars - 1) * sgs.c.carIntervalSeconds / 3600;

  const firstD = lastC + sgs.gapCDSeconds / 3600;
  const lastD = firstD + Math.max(0, sgs.d.numberOfCars - 1) * sgs.d.carIntervalSeconds / 3600;

  return [firstA, lastA, firstB, lastB, firstC, lastC, firstD, lastD];
}

/**
 * Compute the start offset (in seconds) of the last car in group D,
 * accounting for per-group car counts, intervals, and inter-group gaps.
 */
export function computeLastCarOffsetSeconds(sgs: SpeedGroupSettings): number {
  const aLastSec = Math.max(0, sgs.a.numberOfCars - 1) * sgs.a.carIntervalSeconds;
  const bFirstSec = aLastSec + sgs.gapABSeconds;
  const bLastSec = bFirstSec + Math.max(0, sgs.b.numberOfCars - 1) * sgs.b.carIntervalSeconds;
  const cFirstSec = bLastSec + sgs.gapBCSeconds;
  const cLastSec = cFirstSec + Math.max(0, sgs.c.numberOfCars - 1) * sgs.c.carIntervalSeconds;
  const dFirstSec = cLastSec + sgs.gapCDSeconds;
  const dLastSec = dFirstSec + Math.max(0, sgs.d.numberOfCars - 1) * sgs.d.carIntervalSeconds;
  return dLastSec;
}

/**
 * Compute first/last car arrival times for all rows in a day.
 *
 * Matches the reference spreadsheet logic:
 * - The segment arriving AT row N uses the PREVIOUS row's speed
 *   (formula: BJ{N} = BI{N} / AM{N-1})
 * - After a time-add row, the speed from BEFORE the time-add is used
 *   (formula: IF(AJ{N-1}="t", BI{N}/AM{N-2}, BI{N}/AM{N-1}))
 * - 8 independent time streams: First/Last car for groups A, B, C, D
 * - Each group's cars travel at the same speed; only their departure time differs
 * - First Car = MIN across active groups' first-car arrivals
 * - Last Car = MAX across active groups' last-car arrivals
 * - Groups with 0 cars are excluded from MIN/MAX
 * - Time-add rows: no distance component, only addTime (minutes) is added
 */
export function computeTimes(
  rows: RouteRow[],
  startTime: string,
  speedGroupSettings: SpeedGroupSettings,
): RouteRow[] {
  if (rows.length === 0) return [];

  // 8 start times: [firstA, lastA, firstB, lastB, firstC, lastC, firstD, lastD]
  const starts = computeGroupStartTimes(startTime, speedGroupSettings);

  // Which groups are active (have cars)?
  const activeA = speedGroupSettings.a.numberOfCars > 0;
  const activeB = speedGroupSettings.b.numberOfCars > 0;
  const activeC = speedGroupSettings.c.numberOfCars > 0;
  const activeD = speedGroupSettings.d.numberOfCars > 0;

  // Cumulative travel time per group (in fractional hours)
  let travelA = 0;
  let travelB = 0;
  let travelC = 0;
  let travelD = 0;

  // Effective speed per group — the speed used for the NEXT segment's calculation.
  // Only updated from non-time-add rows so that after a time-add, the speed
  // from before the time-add is preserved (matching spreadsheet's IF(AJ="t",...) logic).
  let effSpeedA = 0;
  let effSpeedB = 0;
  let effSpeedC = 0;
  let effSpeedD = 0;

  return rows.map((row, i) => {
    if (i > 0) {
      const segmentDist = row.rallyDistance - rows[i - 1].rallyDistance;

      if (row.type === 't') {
        // Time-add: add specified minutes (converted to hours), no distance component
        travelA += row.addTimeA / 60;
        travelB += row.addTimeB / 60;
        travelC += row.addTimeC / 60;
        travelD += row.addTimeD / 60;
      } else if (segmentDist > 0) {
        // Distance segment: use effective speed (previous non-time-add row's speed)
        if (effSpeedA > 0) travelA += segmentDist / effSpeedA;
        if (effSpeedB > 0) travelB += segmentDist / effSpeedB;
        if (effSpeedC > 0) travelC += segmentDist / effSpeedC;
        if (effSpeedD > 0) travelD += segmentDist / effSpeedD;
      }
    }

    // Update effective speed from non-time-add rows only.
    // This means time-add rows (speed=0) are skipped, preserving the
    // speed from the row before the time-add for the row after it.
    if (row.type !== 't') {
      effSpeedA = row.aSpeed;
      effSpeedB = row.bSpeed;
      effSpeedC = row.cSpeed;
      effSpeedD = row.dSpeed;
    }

    // First Car = MIN of active groups' first-car arrivals
    const firstCandidates: number[] = [];
    if (activeA) firstCandidates.push(starts[0] + travelA);
    if (activeB) firstCandidates.push(starts[2] + travelB);
    if (activeC) firstCandidates.push(starts[4] + travelC);
    if (activeD) firstCandidates.push(starts[6] + travelD);

    // Last Car = MAX of active groups' last-car arrivals
    const lastCandidates: number[] = [];
    if (activeA) lastCandidates.push(starts[1] + travelA);
    if (activeB) lastCandidates.push(starts[3] + travelB);
    if (activeC) lastCandidates.push(starts[5] + travelC);
    if (activeD) lastCandidates.push(starts[7] + travelD);

    const firstCar = firstCandidates.length > 0
      ? Math.min(...firstCandidates)
      : starts[0] + travelA;
    const lastCar = lastCandidates.length > 0
      ? Math.max(...lastCandidates)
      : starts[7] + travelD;

    return {
      ...row,
      firstCarTime: formatHoursToTime(firstCar),
      lastCarTime: formatHoursToTime(lastCar),
    };
  });
}

/**
 * Compute cumulative travel time for a specific speed group.
 * Uses the previous non-time-add row's speed (matching the spreadsheet convention).
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
  let effSpeed = 0;

  for (let i = 0; i < rows.length; i++) {
    if (i > 0) {
      const segmentDist = rows[i].rallyDistance - rows[i - 1].rallyDistance;

      if (rows[i].type === 't') {
        cumulative += getAddTime(rows[i]) / 60;
      } else if (segmentDist > 0 && effSpeed > 0) {
        cumulative += segmentDist / effSpeed;
      }
    }

    // Update effective speed from non-time-add rows only
    if (rows[i].type !== 't') {
      effSpeed = getSpeed(rows[i]);
    }

    times.push(cumulative);
  }

  return times;
}
