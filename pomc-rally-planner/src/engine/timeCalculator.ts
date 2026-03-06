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
 * Check whether any of the four group speeds changed between two rows.
 */
function speedsChanged(a: RouteRow, b: RouteRow): boolean {
  return a.aSpeed !== b.aSpeed || a.bSpeed !== b.bSpeed ||
         a.cSpeed !== b.cSpeed || a.dSpeed !== b.dSpeed;
}

/**
 * Compute first/last car arrival times for all rows in a day.
 *
 * Uses ANCHOR-BASED calculation matching the reference spreadsheet:
 * - An "anchor" tracks the distance and travel-time at the last speed change.
 * - Each row's time = anchorTime + (currentDist − anchorDist) / speed.
 * - The anchor resets whenever any group speed changes, or on time-add rows.
 * - This means a single bad distance value only corrupts THAT row's time;
 *   subsequent rows still compute from the valid anchor and are unaffected.
 *
 * Spreadsheet columns this mirrors:
 *   AZ (IntOdo)     = anchor distance (resets on speed change / time-add)
 *   BA (InitFirstA) = anchor time     (resets to previous row's calculated time)
 *   BI (IncDist)    = currentDist − anchorDist
 *   BJ (D.HrA)      = IncDist / prevSpeed
 *   BZ (First A)    = anchorTime + travel hours/min/sec
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

  // Anchor: distance and travel-time at last speed change (shared anchor dist, per-group travel)
  let anchorDist = rows[0].rallyDistance;
  let anchorTravelA = 0;
  let anchorTravelB = 0;
  let anchorTravelC = 0;
  let anchorTravelD = 0;

  // Effective speed per group — the speed used for the NEXT segment's calculation.
  // Only updated from non-time-add rows so that after a time-add, the speed
  // from before the time-add is preserved (matching spreadsheet's IF(AJ="t",...) logic).
  let effSpeedA = 0;
  let effSpeedB = 0;
  let effSpeedC = 0;
  let effSpeedD = 0;

  // Previous row's calculated travel times (needed when resetting the anchor)
  let prevTravelA = 0;
  let prevTravelB = 0;
  let prevTravelC = 0;
  let prevTravelD = 0;

  return rows.map((row, i) => {
    let curTravelA = 0;
    let curTravelB = 0;
    let curTravelC = 0;
    let curTravelD = 0;

    if (i > 0) {
      // Detect anchor reset: speeds changed between row i-2 and i-1, or current is time-add
      const needsReset = row.type === 't' ||
        (i >= 2 && speedsChanged(rows[i - 1], rows[i - 2]));

      if (needsReset) {
        anchorDist = row.type === 't' ? row.rallyDistance : rows[i - 1].rallyDistance;
        anchorTravelA = prevTravelA;
        anchorTravelB = prevTravelB;
        anchorTravelC = prevTravelC;
        anchorTravelD = prevTravelD;
      }

      if (row.type === 't') {
        // Time-add: add specified minutes (converted to hours), no distance component
        curTravelA = anchorTravelA + row.addTimeA / 60;
        curTravelB = anchorTravelB + row.addTimeB / 60;
        curTravelC = anchorTravelC + row.addTimeC / 60;
        curTravelD = anchorTravelD + row.addTimeD / 60;
        // Advance anchors past the time-add so subsequent rows include the added time
        anchorTravelA = curTravelA;
        anchorTravelB = curTravelB;
        anchorTravelC = curTravelC;
        anchorTravelD = curTravelD;
      } else {
        // Distance segment: incDist from anchor, divided by effective speed
        const incDist = row.rallyDistance - anchorDist;
        curTravelA = anchorTravelA + (effSpeedA > 0 && incDist > 0 ? incDist / effSpeedA : 0);
        curTravelB = anchorTravelB + (effSpeedB > 0 && incDist > 0 ? incDist / effSpeedB : 0);
        curTravelC = anchorTravelC + (effSpeedC > 0 && incDist > 0 ? incDist / effSpeedC : 0);
        curTravelD = anchorTravelD + (effSpeedD > 0 && incDist > 0 ? incDist / effSpeedD : 0);
      }
    }

    // Update effective speed from non-time-add rows only.
    if (row.type !== 't') {
      effSpeedA = row.aSpeed;
      effSpeedB = row.bSpeed;
      effSpeedC = row.cSpeed;
      effSpeedD = row.dSpeed;
    }

    // Save for next iteration's anchor reset
    prevTravelA = curTravelA;
    prevTravelB = curTravelB;
    prevTravelC = curTravelC;
    prevTravelD = curTravelD;

    // First Car = MIN of active groups' first-car arrivals
    const firstCandidates: number[] = [];
    if (activeA) firstCandidates.push(starts[0] + curTravelA);
    if (activeB) firstCandidates.push(starts[2] + curTravelB);
    if (activeC) firstCandidates.push(starts[4] + curTravelC);
    if (activeD) firstCandidates.push(starts[6] + curTravelD);

    // Last Car = MAX of active groups' last-car arrivals
    const lastCandidates: number[] = [];
    if (activeA) lastCandidates.push(starts[1] + curTravelA);
    if (activeB) lastCandidates.push(starts[3] + curTravelB);
    if (activeC) lastCandidates.push(starts[5] + curTravelC);
    if (activeD) lastCandidates.push(starts[7] + curTravelD);

    const firstCar = firstCandidates.length > 0
      ? Math.min(...firstCandidates)
      : starts[0] + curTravelA;
    const lastCar = lastCandidates.length > 0
      ? Math.max(...lastCandidates)
      : starts[7] + curTravelD;

    return {
      ...row,
      firstCarTime: formatHoursToTime(firstCar),
      lastCarTime: formatHoursToTime(lastCar),
    };
  });
}

/**
 * Compute anchor-based travel time for a specific speed group.
 * Uses the same anchor-based logic as computeTimes (matching the spreadsheet).
 * Returns array of travel-time hours for each row.
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
  let anchorDist = rows.length > 0 ? rows[0].rallyDistance : 0;
  let anchorTravel = 0;
  let effSpeed = 0;
  let prevTravel = 0;

  for (let i = 0; i < rows.length; i++) {
    let curTravel = 0;

    if (i > 0) {
      const needsReset = rows[i].type === 't' ||
        (i >= 2 && speedsChanged(rows[i - 1], rows[i - 2]));

      if (needsReset) {
        anchorDist = rows[i].type === 't' ? rows[i].rallyDistance : rows[i - 1].rallyDistance;
        anchorTravel = prevTravel;
      }

      if (rows[i].type === 't') {
        curTravel = anchorTravel + getAddTime(rows[i]) / 60;
        anchorTravel = curTravel;
      } else {
        const incDist = rows[i].rallyDistance - anchorDist;
        curTravel = anchorTravel + (effSpeed > 0 && incDist > 0 ? incDist / effSpeed : 0);
      }
    }

    // Update effective speed from non-time-add rows only
    if (rows[i].type !== 't') {
      effSpeed = getSpeed(rows[i]);
    }

    prevTravel = curTravel;
    times.push(curTravel);
  }

  return times;
}
