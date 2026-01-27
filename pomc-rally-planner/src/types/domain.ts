/** Type codes used in the blackbook planning grid */
export type TypeCode = 'o' | 'f' | 'd' | 'u' | 'l' | 'm' | 't';

/** All valid type codes */
export const TYPE_CODES: TypeCode[] = ['o', 'f', 'd', 'u', 'l', 'm', 't'];

/** Human-readable labels for type codes */
export const TYPE_CODE_LABELS: Record<TypeCode, string> = {
  o: 'Open Section',
  f: 'Flat Terrain',
  d: 'Downhill',
  u: 'Uphill',
  l: 'Speed Limit Change',
  m: 'Marked Control',
  t: 'Time Add (Stop)',
};

/** A single row in the blackbook planning grid */
export interface RouteRow {
  id: string;
  bbPage: number | null;
  bbPage2: number | null;
  terrain: string;
  suggestedType: TypeCode | null;
  suggestedASpeed: number | null;
  rallyDistance: number;
  type: TypeCode | null;
  instructionNumber: number | null;
  aSpeed: number;
  bSpeed: number;
  cSpeed: number;
  dSpeed: number;
  speedLimit: number;
  clue: string;
  lat: number;
  long: number;
  addTimeA: number;
  addTimeB: number;
  addTimeC: number;
  addTimeD: number;
  firstCarTime: string;
  lastCarTime: string;
}

/** Create an empty route row with defaults */
export function createEmptyRow(id?: string): RouteRow {
  return {
    id: id ?? crypto.randomUUID(),
    bbPage: null,
    bbPage2: null,
    terrain: '',
    suggestedType: null,
    suggestedASpeed: null,
    rallyDistance: 0,
    type: null,
    instructionNumber: null,
    aSpeed: 0,
    bSpeed: 0,
    cSpeed: 0,
    dSpeed: 0,
    speedLimit: 60,
    clue: '',
    lat: 0,
    long: 0,
    addTimeA: 0,
    addTimeB: 0,
    addTimeC: 0,
    addTimeD: 0,
    firstCarTime: '',
    lastCarTime: '',
  };
}

/** A single rally day within a project */
export interface RallyDay {
  id: string;
  name: string;
  startTime: string; // HH:MM:SS
  carIntervalSeconds: number;
  numberOfCars: number;
  rows: RouteRow[];
}

/** Create an empty rally day */
export function createEmptyDay(name: string): RallyDay {
  return {
    id: crypto.randomUUID(),
    name,
    startTime: '08:00:00',
    carIntervalSeconds: 60,
    numberOfCars: 30,
    rows: [],
  };
}

/** Speed lookup table entry: maps (terrain, type, A-speed) -> (A, B, C, D speeds) */
export interface SpeedLookupEntry {
  terrain: string;
  type: TypeCode;
  aSpeed: number;
  bSpeed: number;
  cSpeed: number;
  dSpeed: number;
}

/** The complete project file (v1 format — single rally per file) */
export interface RallyProject {
  version: number;
  name: string;
  createdAt: string;
  modifiedAt: string;
  days: RallyDay[];
  speedLookupTable: SpeedLookupEntry[];
}

/** Alias for migration code */
export type RallyProjectV1 = RallyProject;

/** A single rally within a workspace */
export interface Rally {
  id: string;
  name: string;
  locked?: boolean;
  createdAt: string;
  modifiedAt: string;
  days: RallyDay[];
  speedLookupTable: SpeedLookupEntry[];
}

/** Workspace file (v2 format — multiple rallies per file) */
export interface RallyWorkspace {
  version: number; // 2
  createdAt: string;
  modifiedAt: string;
  rallies: Rally[];
}

/** Create a new empty rally */
export function createEmptyRally(name: string): Rally {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    days: [],
    speedLookupTable: [],
  };
}

/** Create a new empty workspace */
export function createEmptyWorkspace(): RallyWorkspace {
  return {
    version: 2,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    rallies: [],
  };
}


// ---------------------------------------------------------------------------
// V3 types: Node-based directed model
// ---------------------------------------------------------------------------

/** A reusable segment template stored in a rally's node library */
export interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  rows: RouteRow[];
  /** IDs of templates that are allowed to precede this node. Empty = any predecessor allowed. */
  allowedPreviousNodes: string[];
  /** Whether this template can be used as the first node in a day */
  isStartNode: boolean;
}

/** A placed instance of a node within a day's route (independent deep copy) */
export interface RouteNode {
  id: string;
  /** ID of the NodeTemplate this was copied from (empty string if created ad-hoc) */
  sourceNodeId: string;
  name: string;
  rows: RouteRow[];
}

/** A single day within an edition — contains ordered nodes instead of direct rows */
export interface RouteDay {
  id: string;
  name: string;
  startTime: string; // HH:MM:SS
  carIntervalSeconds: number;
  numberOfCars: number;
  nodes: RouteNode[];
}

/** Create an empty RouteDay (V3) */
export function createEmptyRouteDay(name: string): RouteDay {
  return {
    id: crypto.randomUUID(),
    name,
    startTime: '08:00:00',
    carIntervalSeconds: 60,
    numberOfCars: 30,
    nodes: [],
  };
}

/** An edition of a rally (e.g. "2024", "2025") */
export interface RallyEdition {
  id: string;
  name: string;
  days: RouteDay[];
}

/** Create an empty edition */
export function createEmptyEdition(name: string): RallyEdition {
  return {
    id: crypto.randomUUID(),
    name,
    days: [],
  };
}

/** A single rally within a V3 workspace */
export interface RallyV3 {
  id: string;
  name: string;
  locked?: boolean;
  createdAt: string;
  modifiedAt: string;
  nodeLibrary: NodeTemplate[];
  editions: RallyEdition[];
  speedLookupTable: SpeedLookupEntry[];
}

/** Workspace file (v3 format — node-based directed model) */
export interface RallyWorkspaceV3 {
  version: 3;
  createdAt: string;
  modifiedAt: string;
  rallies: RallyV3[];
}

/** Union type for any workspace version */
export type AnyRallyWorkspace = RallyWorkspace | RallyWorkspaceV3;

/** Create an empty node template */
export function createEmptyNodeTemplate(name?: string): NodeTemplate {
  return {
    id: crypto.randomUUID(),
    name: name ?? 'New Node',
    description: '',
    rows: [],
    allowedPreviousNodes: [],
    isStartNode: false,
  };
}

/** Create a RouteNode from a NodeTemplate (deep-clones rows with new UUIDs) */
export function createRouteNode(template: NodeTemplate): RouteNode {
  return {
    id: crypto.randomUUID(),
    sourceNodeId: template.id,
    name: template.name,
    rows: template.rows.map(r => ({ ...r, id: crypto.randomUUID() })),
  };
}

/** Create an empty RouteNode (not from a template) */
export function createEmptyRouteNode(name?: string): RouteNode {
  return {
    id: crypto.randomUUID(),
    sourceNodeId: '',
    name: name ?? 'Untitled Node',
    rows: [],
  };
}

/** Create a new empty V3 rally */
export function createEmptyRallyV3(name: string): RallyV3 {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    nodeLibrary: [],
    editions: [],
    speedLookupTable: [],
  };
}

/** Create a new empty V3 workspace */
export function createEmptyWorkspaceV3(): RallyWorkspaceV3 {
  return {
    version: 3,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    rallies: [],
  };
}

// ---------------------------------------------------------------------------

/** CSV export row - matches the 15-column scoring program schema */
export interface CsvExportRow {
  No: string | number;
  Instruction: string;
  Type: string;
  Distance: number;
  A_Speed: number;
  B_Speed: number;
  C_Speed: number;
  D_Speed: number;
  Limit: number;
  AddTime_A: number;
  AddTime_B: number;
  AddTime_C: number;
  AddTime_D: number;
  Lat: number;
  Long: number;
}
