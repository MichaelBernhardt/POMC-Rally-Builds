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

/** The complete project file */
export interface RallyProject {
  version: number;
  name: string;
  createdAt: string;
  modifiedAt: string;
  days: RallyDay[];
  speedLookupTable: SpeedLookupEntry[];
}

/** Create a new empty project */
export function createEmptyProject(name: string): RallyProject {
  return {
    version: 1,
    name,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    days: [],
    speedLookupTable: [],
  };
}

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
