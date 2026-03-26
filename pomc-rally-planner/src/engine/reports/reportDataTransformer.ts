import { RouteRow, TypeCode } from '../../types/domain';

/** Only rows with a type code are exported to reports */
export function getExportableRows(rows: RouteRow[]): RouteRow[] {
  return rows.filter(r => r.type !== null);
}

/** Competitor schedules: typed rows excluding controls (typ 'm') */
export function getCompetitorRows(rows: RouteRow[]): RouteRow[] {
  return rows.filter(r => r.type !== null && r.type !== 'm');
}

/** CP files: only marked control rows */
export function getControlPointRows(rows: RouteRow[]): RouteRow[] {
  return rows.filter(r => r.type === 'm');
}

/** Remove {curly brace} annotations from instruction text */
export function stripCurlyBraces(text: string): string {
  return text.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
}

/** Map internal type to export type: 'm' -> 'v', everything else -> 'a' */
export function getExportType(type: TypeCode): 'a' | 'v' {
  return type === 'm' ? 'v' : 'a';
}

/** Get the speed for a specific group from a row */
export function getSpeedForGroup(row: RouteRow, group: 'a' | 'b' | 'c' | 'd'): number {
  switch (group) {
    case 'a': return row.aSpeed;
    case 'b': return row.bSpeed;
    case 'c': return row.cSpeed;
    case 'd': return row.dSpeed;
  }
}

/** Get the addTime for a specific group from a row */
export function getAddTimeForGroup(row: RouteRow, group: 'a' | 'b' | 'c' | 'd'): number {
  switch (group) {
    case 'a': return row.addTimeA;
    case 'b': return row.addTimeB;
    case 'c': return row.addTimeC;
    case 'd': return row.addTimeD;
  }
}

/** Compute the headline speed for a group (max speed among regularity rows) */
export function computeHeadlineSpeed(rows: RouteRow[], group: 'a' | 'b' | 'c' | 'd'): number {
  const regularityTypes: TypeCode[] = ['o', 'f', 'd', 'u', 'l'];
  let max = 0;
  for (const row of rows) {
    if (row.type && regularityTypes.includes(row.type)) {
      const speed = getSpeedForGroup(row, group);
      if (speed > max) max = speed;
    }
  }
  return max;
}

/** Format ISO date "2026-03-13" to "13 Mar 2026" */
export function formatDayDate(isoDate: string): string {
  if (!isoDate) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} ${months[monthIdx] ?? ''} ${year}`;
}

/**
 * Build instruction text for competitor schedules:
 * - Strip curly braces
 * - For time-add rows, append the addTime in minutes
 */
export function formatCompetitorInstruction(row: RouteRow, group: 'a' | 'b' | 'c' | 'd'): string {
  let text = stripCurlyBraces(row.clue);
  if (row.type === 't') {
    const addTime = getAddTimeForGroup(row, group);
    if (addTime > 0) {
      text = `${text} ${addTime} minutes`;
    }
  }
  return text;
}

/** Convert fractional hours to seconds from midnight (integer) */
export function hoursToSecondsFromMidnight(hours: number): number {
  return Math.round(hours * 3600);
}

/** Group label for headers: 'a' -> 'A', etc. */
export function groupLabel(group: 'a' | 'b' | 'c' | 'd'): string {
  return group.toUpperCase();
}
