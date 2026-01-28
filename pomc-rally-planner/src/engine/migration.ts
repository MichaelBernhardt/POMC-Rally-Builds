import {
  RallyProjectV1,
  RallyWorkspace,
  RallyWorkspaceV3,
  Rally,
  RallyV3,
  RallyEdition,
  RouteDay,
  RouteNode,
} from '../types/domain';

/**
 * Detect the format version of a parsed .rally.json file.
 * - Version 1: single rally with top-level `days` array (RallyProject)
 * - Version 2: workspace with `rallies` array, no `nodeLibrary` on rallies
 * - Version 3: workspace with `rallies` array, rallies have `editions` and `nodeLibrary`
 */
export function detectFileVersion(data: unknown): 1 | 2 | 3 {
  if (
    data !== null &&
    typeof data === 'object' &&
    'rallies' in data &&
    Array.isArray((data as Record<string, unknown>).rallies)
  ) {
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
    if ((data as Record<string, unknown>).version === 3) {
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
    days,
  };

  return {
    id: rally.id,
    name: rally.name,
    locked: rally.locked,
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
