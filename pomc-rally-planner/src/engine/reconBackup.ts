import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { RouteNode, RouteRow, TypeCode, ReconEntry } from '../types/domain';

/** A single row's recon snapshot */
interface ReconBackupRow {
  clue: string;
  type: TypeCode | null;
  checkDist: number | null;
  checkLat: number | null;
  checkLong: number | null;
  existingDistance: number;
  distanceHistory: ReconEntry[];
}

/** A node's recon snapshot */
interface ReconBackupNode {
  name: string;
  rows: ReconBackupRow[];
}

/** Top-level backup payload */
export interface ReconBackupData {
  timestamp: string;
  rally: string;
  edition: string;
  day: string;
  nodes: ReconBackupNode[];
}

function hasReconData(row: RouteRow): boolean {
  return row.checkDist != null || row.checkLat != null || row.checkLong != null;
}

/**
 * Build a JSON-serializable backup of recon measurement data from the given nodes.
 * Only includes rows that have at least one recon value (checkDist/checkLat/checkLong).
 */
export function buildReconBackup(
  nodes: RouteNode[],
  rallyName: string,
  editionName: string,
  dayName: string,
): ReconBackupData {
  return {
    timestamp: new Date().toISOString(),
    rally: rallyName,
    edition: editionName,
    day: dayName,
    nodes: nodes
      .map(node => {
        const reconRows = node.rows.filter(hasReconData);
        if (reconRows.length === 0) return null;
        return {
          name: node.name,
          rows: reconRows.map(r => ({
            clue: r.clue,
            type: r.type,
            checkDist: r.checkDist,
            checkLat: r.checkLat,
            checkLong: r.checkLong,
            existingDistance: r.rallyDistance,
            distanceHistory: r.distanceHistory,
          })),
        };
      })
      .filter((n): n is ReconBackupNode => n !== null),
  };
}

/**
 * Prompt the user with a save dialog and write recon backup JSON.
 * Returns true if the file was saved, false if the user cancelled.
 */
export async function saveReconBackup(data: ReconBackupData): Promise<boolean> {
  const safeName = data.rally.replace(/[^a-zA-Z0-9_-]/g, '-');
  const safeDay = data.day.replace(/[^a-zA-Z0-9_-]/g, '-');
  const dateStr = new Date().toISOString().slice(0, 10);
  const defaultName = `Recon_${safeName}_${safeDay}_${dateStr}.json`;

  try {
    const savePath = await save({
      defaultPath: defaultName,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });

    if (savePath) {
      await writeTextFile(savePath, JSON.stringify(data, null, 2));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
