import {
  RallyProjectV1,
  RallyWorkspace,
  RallyWorkspaceV3,
  Rally,
  RallyV3,
  RallyEdition,
  RouteDay,
  RouteNode,
  RouteRow,
  ReconEntry,
} from '../types/domain';

/**
 * Detect the format version of a parsed .rally.json file.
 * - Version 1: single rally with top-level `days` array (RallyProject)
 * - Version 2: workspace with `rallies` array, no `nodeLibrary` on rallies
 * - Version 3: workspace with `rallies` array, rallies have `editions` and `nodeLibrary`
 */
export function detectFileVersion(data: unknown): 1 | 2 | 3 | 4 {
  if (
    data !== null &&
    typeof data === 'object' &&
    'rallies' in data &&
    Array.isArray((data as Record<string, unknown>).rallies)
  ) {
    // Check explicit version field first
    const version = (data as Record<string, unknown>).version;
    if (version === 4) return 4;

    // Distinguish v2 vs v3 by checking if first rally has `editions`
    const rallies = (data as Record<string, unknown>).rallies as unknown[];
    if (
      rallies.length > 0 &&
      rallies[0] !== null &&
      typeof rallies[0] === 'object' &&
      'editions' in (rallies[0] as Record<string, unknown>)
    ) {
      return 3;
    }
    // Also check explicit version field
    if (version === 3) {
      return 3;
    }
    return 2;
  }
  return 1;
}

/**
 * Migrate a v1 single-rally file into a v2 workspace.
 * The original rally's name, days, and speed table are preserved.
 */
export function migrateV1ToWorkspace(data: RallyProjectV1): RallyWorkspace {
  return {
    version: 2,
    createdAt: data.createdAt ?? new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    rallies: [
      {
        id: crypto.randomUUID(),
        name: data.name ?? 'Untitled Rally',
        createdAt: data.createdAt ?? new Date().toISOString(),
        modifiedAt: data.modifiedAt ?? new Date().toISOString(),
        days: data.days ?? [],
        speedLookupTable: data.speedLookupTable ?? [],
      },
    ],
  };
}

/**
 * Migrate a single V2 Rally into a V3 RallyV3.
 * - All days are wrapped in a single default edition named "Default"
 * - Each day's rows become a single RouteNode (entire day as one segment)
 * - nodeLibrary starts empty
 */
function migrateRallyV2ToV3(rally: Rally): RallyV3 {
  const days: RouteDay[] = rally.days.map(day => {
    const node: RouteNode = {
      id: crypto.randomUUID(),
      sourceNodeId: '',
      name: day.name,
      rows: day.rows,
    };
    return {
      id: day.id,
      name: day.name,
      startTime: day.startTime,
      carIntervalSeconds: day.carIntervalSeconds,
      numberOfCars: day.numberOfCars,
      reconDistanceTolerance: 0.01,
      nodes: [node],
    };
  });

  const edition: RallyEdition = {
    id: crypto.randomUUID(),
    name: 'Default',
    locked: rally.locked,
    days,
  };

  return {
    id: rally.id,
    name: rally.name,
    createdAt: rally.createdAt,
    modifiedAt: rally.modifiedAt,
    nodeLibrary: [],
    editions: [edition],
    speedLookupTable: rally.speedLookupTable,
  };
}

/**
 * Migrate a v2 workspace into a v3 workspace.
 * Each rally is converted to V3 format with editions and nodes.
 */
export function migrateV2ToV3(data: RallyWorkspace): RallyWorkspaceV3 {
  return {
    version: 3,
    createdAt: data.createdAt,
    modifiedAt: new Date().toISOString(),
    rallies: data.rallies.map(migrateRallyV2ToV3),
  };
}

/**
 * Migrate a row's distanceHistory from number[] to ReconEntry[].
 * Ensures latHistory/longHistory arrays exist (empty by default).
 * Idempotent: if entries are already ReconEntry objects, they are left as-is.
 */
function migrateRowFields(row: RouteRow): RouteRow {
  const distanceHistory: ReconEntry[] = (row.distanceHistory ?? []).map(
    (entry: unknown) =>
      typeof entry === 'number'
        ? { value: entry, date: 'Unknown' }
        : (entry as ReconEntry),
  );

  const raw = row as unknown as Record<string, unknown>;
  const latHistory = (raw.latHistory as ReconEntry[] | undefined) ?? [];
  const longHistory = (raw.longHistory as ReconEntry[] | undefined) ?? [];

  const checkLat = (raw.checkLat as number | null | undefined) ?? null;
  const checkLong = (raw.checkLong as number | null | undefined) ?? null;

  return { ...row, distanceHistory, latHistory, longHistory, checkLat, checkLong };
}

/**
 * Migrate a v3 workspace to v4.
 *
 * 1. Converts distanceHistory entries from bare numbers to ReconEntry objects.
 * 2. Walks all route nodes in editions — for each node that references a
 *    library template (via sourceNodeId), copies non-zero lat/long values
 *    from the route rows into the template rows' latHistory/longHistory.
 *    This back-fills the history that would have been recorded if the
 *    lat/long history feature had existed earlier.
 * 3. Sets each template row's lat/long to the average of its last 3 history
 *    entries (matching the push-to-library behaviour).
 */
export function migrateV3ToV4(data: RallyWorkspaceV3): RallyWorkspaceV3 {
  return {
    ...data,
    version: 4,
    modifiedAt: new Date().toISOString(),
    rallies: data.rallies.map(migrateRallyToV4),
  };
}

function migrateRallyToV4(rally: RallyV3): RallyV3 {
  // Step 1: Migrate field formats on all rows (distanceHistory, ensure arrays)
  const templates = rally.nodeLibrary.map(t => ({
    ...t,
    rows: t.rows.map(migrateRowFields),
  }));

  const editions = rally.editions.map(ed => ({
    ...ed,
    days: ed.days.map(day => ({
      ...day,
      nodes: day.nodes.map(node => ({
        ...node,
        rows: node.rows.map(migrateRowFields),
      })),
    })),
  }));

  // Step 2: Build a mutable map of template rows for back-filling history
  const templateMap = new Map<string, RouteRow[]>();
  for (const t of templates) {
    // Deep-clone the rows so we can mutate latHistory/longHistory
    templateMap.set(t.id, t.rows.map(r => ({
      ...r,
      latHistory: [...r.latHistory],
      longHistory: [...r.longHistory],
    })));
  }

  // Step 3: Walk every route node and push lat/long values into template history.
  // Only back-fill rows whose template latHistory is currently empty (idempotent).
  for (const ed of editions) {
    for (const day of ed.days) {
      for (const node of day.nodes) {
        if (!node.sourceNodeId) continue;
        const tRows = templateMap.get(node.sourceNodeId);
        if (!tRows) continue;

        for (let i = 0; i < node.rows.length && i < tRows.length; i++) {
          const nodeRow = node.rows[i];
          if ((nodeRow.lat !== 0 || nodeRow.long !== 0) && tRows[i].latHistory.length === 0) {
            tRows[i].latHistory.push({ value: nodeRow.lat, date: 'Unknown' });
            tRows[i].longHistory.push({ value: nodeRow.long, date: 'Unknown' });
          }
        }
      }
    }
  }

  // Step 4: Set template lat/long to average of last 3 history entries
  for (const tRows of templateMap.values()) {
    for (const row of tRows) {
      if (row.latHistory.length > 0) {
        const last3Lat = row.latHistory.slice(-3);
        const last3Long = row.longHistory.slice(-3);
        row.lat = Math.round((last3Lat.reduce((s, e) => s + e.value, 0) / last3Lat.length) * 1e6) / 1e6;
        row.long = Math.round((last3Long.reduce((s, e) => s + e.value, 0) / last3Long.length) * 1e6) / 1e6;
      }
    }
  }

  // Step 5: Write the updated template rows back
  const updatedTemplates = templates.map(t => ({
    ...t,
    rows: templateMap.get(t.id) ?? t.rows,
  }));

  return { ...rally, nodeLibrary: updatedTemplates, editions };
}
