import { RouteRow } from '../types/domain';

export interface RowChangeSummary {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  details: string[];  // Human-readable change descriptions
}

/** Fields to exclude when comparing rows (computed/identity fields) */
const EXCLUDED_FIELDS: (keyof RouteRow)[] = ['id', 'firstCarTime', 'lastCarTime'];

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
 * Compare rows from a node instance against the template rows.
 * Comparison is done by position index since rows are deep-copied with new IDs when placed.
 */
export function compareRows(nodeRows: RouteRow[], templateRows: RouteRow[]): RowChangeSummary {
  const summary: RowChangeSummary = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
    details: [],
  };

  const nodeCount = nodeRows.length;
  const templateCount = templateRows.length;
  const commonCount = Math.min(nodeCount, templateCount);

  // Compare rows that exist in both
  for (let i = 0; i < commonCount; i++) {
    if (rowsEqual(nodeRows[i], templateRows[i])) {
      summary.unchanged++;
    } else {
      summary.modified++;
      const diffs = getRowDifferences(i, nodeRows[i], templateRows[i]);
      summary.details.push(...diffs);
    }
  }

  // Count added rows (in node but not in template)
  if (nodeCount > templateCount) {
    summary.added = nodeCount - templateCount;
    for (let i = templateCount; i < nodeCount; i++) {
      const dist = nodeRows[i].rallyDistance;
      summary.details.push(`Row ${i + 1}: Added (distance ${dist.toFixed(2)})`);
    }
  }

  // Count removed rows (in template but not in node)
  if (templateCount > nodeCount) {
    summary.removed = templateCount - nodeCount;
    for (let i = nodeCount; i < templateCount; i++) {
      const dist = templateRows[i].rallyDistance;
      summary.details.push(`Row ${i + 1}: Will be removed (distance ${dist.toFixed(2)})`);
    }
  }

  return summary;
}

/** Check if there are any changes between node and template rows */
export function hasChanges(nodeRows: RouteRow[], templateRows: RouteRow[]): boolean {
  const summary = compareRows(nodeRows, templateRows);
  return summary.added > 0 || summary.removed > 0 || summary.modified > 0;
}
