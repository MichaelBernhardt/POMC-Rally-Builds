import { RallyProjectV1, RallyWorkspace } from '../types/domain';

/**
 * Detect the format version of a parsed .rally.json file.
 * - Version 1: single rally with top-level `days` array (RallyProject)
 * - Version 2: workspace with `rallies` array (RallyWorkspace)
 */
export function detectFileVersion(data: unknown): 1 | 2 {
  if (
    data !== null &&
    typeof data === 'object' &&
    'rallies' in data &&
    Array.isArray((data as Record<string, unknown>).rallies)
  ) {
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
