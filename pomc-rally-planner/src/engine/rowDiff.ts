import { RouteRow } from '../types/domain';

export interface RowChangeSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  details: string[];  // Human-readable change descriptions
}

/** Fields to exclude when comparing rows (computed/identity/transient fields) */
const EXCLUDED_FIELDS: (keyof RouteRow)[] = [
  'id', 'firstCarTime', 'lastCarTime',
  'distanceHistory', 'latHistory', 'longHistory',
];

/** Compare two row values for equality */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null && b === null) return true;
  if (a === undefined && b === undefined) return true;
  // Treat 0 and '' as equivalent for optional number fields
  if ((a === 0 || a === '') && (b === 0 || b === '')) return true;
  return false;
}

/** Check if two rows are semantically equal (ignoring excluded fields) */
function rowsEqual(a: RouteRow, b: RouteRow): boolean {
  for (const key of Object.keys(a) as (keyof RouteRow)[]) {
    if (EXCLUDED_FIELDS.includes(key)) continue;
    if (!valuesEqual(a[key], b[key])) return false;
  }
  return true;
}

/** Get a human-readable description of differences between two rows */
function getRowDifferences(index: number, nodeRow: RouteRow, templateRow: RouteRow): string[] {
  const diffs: string[] = [];

  for (const key of Object.keys(nodeRow) as (keyof RouteRow)[]) {
    if (EXCLUDED_FIELDS.includes(key)) continue;
    if (!valuesEqual(nodeRow[key], templateRow[key])) {
      const oldVal = templateRow[key];
      const newVal = nodeRow[key];
      diffs.push(`Row ${index + 1}: ${key} changed from "${oldVal}" to "${newVal}"`);
    }
  }

  return diffs;
}

/**
 * Serialize all compared fields of a row into a string for fast equality checks.
 * Excludes the same fields as rowsEqual (id, computed fields, history).
 */
export function rowFingerprint(row: RouteRow): string {
  const parts: string[] = [];
  for (const key of Object.keys(row) as (keyof RouteRow)[]) {
    if (EXCLUDED_FIELDS.includes(key)) continue;
    const v = row[key];
    // Normalize 0 and '' to the same representation
    parts.push(v === 0 || v === '' ? '~' : String(v ?? ''));
  }
  return parts.join('\x00');
}

/**
 * Compute the Longest Common Subsequence between two fingerprint arrays.
 * Returns matched pairs as [indexInA, indexInB][].
 * Standard O(n*m) DP — for ~1300 rows this is ~1.7M ops, a few ms in-browser.
 */
export function lcsIndices(aFps: string[], bFps: string[]): [number, number][] {
  const n = aFps.length;
  const m = bFps.length;

  // Build DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (aFps[i - 1] === bFps[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find matched pairs
  const pairs: [number, number][] = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (aFps[i - 1] === bFps[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  pairs.reverse();
  return pairs;
}

/**
 * Build a full index map from A→B, pairing LCS matches plus gap rows.
 * Gap rows between LCS anchors are paired positionally (modified rows).
 * Unmatched extras (added/removed) are not included in the map.
 */
export function buildMatchMap(aFps: string[], bFps: string[]): Map<number, number> {
  const lcs = lcsIndices(aFps, bFps);
  const map = new Map<number, number>();

  let ai = 0, bi = 0;
  for (const [matchAi, matchBi] of lcs) {
    // Pair gap rows positionally
    const paired = Math.min(matchAi - ai, matchBi - bi);
    for (let k = 0; k < paired; k++) {
      map.set(ai + k, bi + k);
    }
    // LCS match
    map.set(matchAi, matchBi);
    ai = matchAi + 1;
    bi = matchBi + 1;
  }

  // Trailing gap
  const paired = Math.min(aFps.length - ai, bFps.length - bi);
  for (let k = 0; k < paired; k++) {
    map.set(ai + k, bi + k);
  }

  return map;
}

/**
 * Compare rows from a node instance against the template rows.
 * Uses LCS-based diff so insertions/deletions don't cascade false "modified" results.
 */
export function compareRows(nodeRows: RouteRow[], templateRows: RouteRow[]): RowChangeSummary {
  const summary: RowChangeSummary = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    details: [],
  };

  const nodeFps = nodeRows.map(rowFingerprint);
  const templateFps = templateRows.map(rowFingerprint);
  const matches = lcsIndices(nodeFps, templateFps);

  // Walk both sequences using LCS matches as anchors
  let ni = 0; // current position in nodeRows
  let ti = 0; // current position in templateRows

  for (const [matchNi, matchTi] of matches) {
    // Process the gap before this anchor
    const nodeGap = matchNi - ni;
    const templateGap = matchTi - ti;
    const pairedCount = Math.min(nodeGap, templateGap);

    // Pair up unmatched rows as modified
    for (let k = 0; k < pairedCount; k++) {
      summary.modified++;
      const diffs = getRowDifferences(ni + k, nodeRows[ni + k], templateRows[ti + k]);
      summary.details.push(...diffs);
    }

    // Extras on node side → added
    for (let k = pairedCount; k < nodeGap; k++) {
      summary.added++;
      summary.details.push(`Row ${ni + k + 1}: Added`);
    }

    // Extras on template side → removed
    for (let k = pairedCount; k < templateGap; k++) {
      summary.removed++;
      const dist = templateRows[ti + k].rallyDistance;
      summary.details.push(`Row ${ti + k + 1}: Will be removed (distance ${dist.toFixed(2)})`);
    }

    // The anchor itself is unchanged (fingerprints matched)
    summary.unchanged++;
    ni = matchNi + 1;
    ti = matchTi + 1;
  }

  // Process trailing gap after last anchor
  const nodeGap = nodeRows.length - ni;
  const templateGap = templateRows.length - ti;
  const pairedCount = Math.min(nodeGap, templateGap);

  for (let k = 0; k < pairedCount; k++) {
    summary.modified++;
    const diffs = getRowDifferences(ni + k, nodeRows[ni + k], templateRows[ti + k]);
    summary.details.push(...diffs);
  }

  for (let k = pairedCount; k < nodeGap; k++) {
    summary.added++;
    summary.details.push(`Row ${ni + k + 1}: Added`);
  }

  for (let k = pairedCount; k < templateGap; k++) {
    summary.removed++;
    const dist = templateRows[ti + k].rallyDistance;
    summary.details.push(`Row ${ti + k + 1}: Will be removed (distance ${dist.toFixed(2)})`);
  }

  return summary;
}

/** Check if there are any changes between node and template rows */
export function hasChanges(nodeRows: RouteRow[], templateRows: RouteRow[]): boolean {
  const summary = compareRows(nodeRows, templateRows);
  return summary.added > 0 || summary.removed > 0 || summary.modified > 0;
}
