import type { RouteRow } from '../types/domain';

/**
 * Estimate checkDist for a row using drift interpolation from surrounding measured points.
 * Same algorithm as getEstimatedCheckDist in GridColumns.tsx (which uses GridApi for rendering).
 */
export function estimateCheckDist(rows: RouteRow[], index: number): number | null {
  if (index <= 0 || index >= rows.length) return null;
  const first = rows[0];
  if (!first) return null;
  const baseCheck = first.checkDist ?? 0;
  const baseRally = first.rallyDistance ?? 0;
  const data = rows[index];
  for (let i = index - 1; i >= 0; i--) {
    const prev = rows[i];
    if (prev.checkDist == null) continue;
    const denom = prev.checkDist - baseCheck;
    if (denom === 0) return Math.round((baseCheck + (data.rallyDistance - baseRally)) * 100) / 100;
    const delta = (prev.checkDist - baseCheck) - (prev.rallyDistance - baseRally);
    const error = delta / denom;
    return Math.round((baseCheck + (data.rallyDistance - baseRally) * (1 + error)) * 100) / 100;
  }
  return null;
}

/** Count rows with null checkDist that can be estimated (have a prior measured anchor). */
export function countEstimableRows(rows: RouteRow[]): { count: number; indices: number[] } {
  const indices: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].checkDist == null && estimateCheckDist(rows, i) !== null) {
      indices.push(i);
    }
  }
  return { count: indices.length, indices };
}

/** Return a new array with estimated checkDist filled in for unmeasured rows. No mutation. */
export function fillEstimatedCheckDists(rows: RouteRow[]): RouteRow[] {
  let changed = false;
  const result = rows.map((row, i) => {
    if (row.checkDist != null) return row;
    const est = estimateCheckDist(rows, i);
    if (est === null) return row;
    changed = true;
    return { ...row, checkDist: est };
  });
  return changed ? result : rows;
}
