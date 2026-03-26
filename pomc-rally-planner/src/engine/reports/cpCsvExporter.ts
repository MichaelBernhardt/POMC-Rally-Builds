import Papa from 'papaparse';
import { RouteRow, SpeedGroupSettings } from '../../types/domain';
import { computeCumulativeForGroup, computeGroupStartTimes } from '../timeCalculator';
import { getControlPointRows, hoursToSecondsFromMidnight } from './reportDataTransformer';

export interface CpCsvOptions {
  rows: RouteRow[];
  startTime: string;
  speedGroupSettings: SpeedGroupSettings;
}

export function generateCpCsv(options: CpCsvOptions): string {
  const { rows, startTime, speedGroupSettings } = options;

  // Compute cumulative travel times for all rows per group
  const timesA = computeCumulativeForGroup(rows, 'a');
  const timesB = computeCumulativeForGroup(rows, 'b');
  const timesC = computeCumulativeForGroup(rows, 'c');
  const timesD = computeCumulativeForGroup(rows, 'd');

  // Compute start time offsets for the 1st car in each group (in fractional hours)
  const starts = computeGroupStartTimes(startTime, speedGroupSettings);
  // starts = [firstA, lastA, firstB, lastB, firstC, lastC, firstD, lastD]
  const startA = starts[0];
  const startB = starts[2];
  const startC = starts[4];
  const startD = starts[6];

  // Filter to control points and build data with original row indices
  const cpData: {
    No: number;
    Lat: number;
    Long: number;
    Dist: number;
    A_Time: number;
    B_Time: number;
    C_Time: number;
    D_Time: number;
  }[] = [];

  let cpNum = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].type === 'm') {
      cpNum++;
      cpData.push({
        No: cpNum,
        Lat: rows[i].lat,
        Long: rows[i].long,
        Dist: parseFloat(rows[i].rallyDistance.toFixed(2)),
        A_Time: hoursToSecondsFromMidnight(startA + timesA[i]),
        B_Time: hoursToSecondsFromMidnight(startB + timesB[i]),
        C_Time: hoursToSecondsFromMidnight(startC + timesC[i]),
        D_Time: hoursToSecondsFromMidnight(startD + timesD[i]),
      });
    }
  }

  return Papa.unparse(cpData);
}
