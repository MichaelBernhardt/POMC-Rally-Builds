/**
 * Magnum Rally Excel (.xlsx) importer.
 *
 * Parses the Magnum 2025 BBR3 spreadsheet format into the app's RouteRow,
 * SpeedLookupEntry, and TimeAddLookupEntry types. Preserves all survey
 * history (distance checks, GPS coordinate readings) across multiple cycles.
 *
 * The spreadsheet has two horizontal sections per route sheet:
 *   Section 1 (cols A-AD): Raw survey/measurement data with history
 *   Section 2 (cols AE-CL): Processed rally data (types, speeds, instructions)
 *
 * Section 2 maps almost 1:1 to RouteRow fields, while Section 1 provides
 * the historical survey data for distanceHistory/latHistory/longHistory.
 */

import * as XLSX from 'xlsx';
import {
  RouteRow,
  ReconEntry,
  SpeedLookupEntry,
  TimeAddLookupEntry,
  TypeCode,
  TYPE_CODES,
  createEmptyRow,
} from '../types/domain';

// ---------------------------------------------------------------------------
// Sheet categorisation
// ---------------------------------------------------------------------------

export interface SheetCategory {
  routeSheets: string[];
  alternateSheets: string[];
  speedSheets: string[];
  timeAddSheet: string | null;
  skipSheets: string[];
}

const SPEED_SHEET_MAP: Record<string, TypeCode> = {
  FlatUnd: 'f',
  UpHill: 'u',
  DownHill: 'd',
  SLimit: 'l',
  OpenSect: 'o',
};

export function categorizeSheets(sheetNames: string[]): SheetCategory {
  const result: SheetCategory = {
    routeSheets: [],
    alternateSheets: [],
    speedSheets: [],
    timeAddSheet: null,
    skipSheets: [],
  };

  for (const name of sheetNames) {
    if (name.startsWith('BB_')) {
      result.routeSheets.push(name);
    } else if (name in SPEED_SHEET_MAP) {
      result.speedSheets.push(name);
    } else if (name === 'TimeAdd') {
      result.timeAddSheet = name;
    } else if (
      name.startsWith('RS_Data') ||
      name === 'GroupStTimes' ||
      name === 'Identifiers' ||
      name === 'Sheet1'
    ) {
      result.skipSheets.push(name);
    } else {
      // Remaining sheets are alternate routes
      result.alternateSheets.push(name);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a cell value as a number, returning null if empty/non-numeric. */
function numCell(ws: XLSX.WorkSheet, r: number, c: number): number | null {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return null;
  // Empty strings (type 's' with value '') should be treated as null, not 0
  if (cell.v === '' || cell.v == null) return null;
  const v = Number(cell.v);
  return isNaN(v) ? null : v;
}

/** Read a cell value as a string. */
function strCell(ws: XLSX.WorkSheet, r: number, c: number): string {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return '';
  return String(cell.v);
}

function isValidTypeCode(v: string): v is TypeCode {
  return TYPE_CODES.includes(v as TypeCode);
}

/** Round to N decimal places. */
function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// Column layout for BB_2025_* (main route sheets)
// ---------------------------------------------------------------------------

/**
 * Fixed column indices for the main BB_2025 route sheets.
 *
 * Section 1: Raw survey data (A-AD)
 */
const RAW = {
  bbPage: 0,        // A - BB Pg
  terrain: 1,       // B - Terrain
  suggestedType: 2, // C - Suggested Type
  suggestedASpeed: 3, // D - Suggested A Speed
  bbDist: 4,        // E - Dist as per BB
  adjAddIn: 5,      // F - Adj. for add in
  adjRallyDist: 6,  // G - Adj to Rally dist
  rallyDist: 7,     // H - Rally dist (primary)
  currentSurvey: 8, // I - Current Survey distance
  error: 9,         // J - Error %
  delta: 10,        // K - δ
  clue: 11,         // L - Clue (short)
  speedLimit: 12,   // M - Speed Limit
  normalDist: 13,   // N - Normalised Dist
  prev1Raw: 14,     // O - Previous Survey #1 Raw
  prev1Adj: 15,     // P - Previous Survey #1 Adjusted
  prev2Raw: 16,     // Q - Previous Survey #2 Raw
  prev2Adj: 17,     // R - Previous Survey #2 Adjusted
  prev3Raw: 18,     // S - Previous Survey #3 Raw
  prev3Adj: 19,     // T - Previous Survey #3 Adjusted
  avgLat: 20,       // U - Latitude (averaged)
  avgLong: 21,      // V - Longitude (averaged)
  currLat: 22,      // W - Current Survey Latitude
  currLong: 23,     // X - Current Survey Longitude
  prev1Lat: 24,     // Y - Previous #1 Latitude
  prev1Long: 25,    // Z - Previous #1 Longitude
  prev2Lat: 26,     // AA - Previous #2 Latitude
  prev2Long: 27,    // AB - Previous #2 Longitude
  prev3Lat: 28,     // AC - Previous #3 Latitude
  prev3Long: 29,    // AD - Previous #3 Longitude
} as const;

/**
 * Section 2: Processed rally data (AE-CL).
 * Row 3 contains headers for this section.
 */
const PROC = {
  bbPage: 30,        // AE - BB Pg
  bbP2: 31,          // AF - BB P2 (instruction type: 'a'/'v')
  terrain: 32,       // AG - Terrain
  suggestedType: 33, // AH - Sugg. Typ
  suggestedASpeed: 34, // AI - Sugg. Asp
  rallyDist: 35,     // AJ - Rally dist
  type: 36,          // AK - Typ (TypeCode)
  instrNum: 37,      // AL - Instr. Num.
  checkDist: 38,     // AM - CheckDist
  aSpeed: 39,        // AN - A Sp (or addTimeA when type='t')
  bSpeed: 40,        // AO - B Sp (or addTimeB when type='t')
  cSpeed: 41,        // AP - C Sp (or addTimeC when type='t')
  dSpeed: 42,        // AQ - D Sp (or addTimeD when type='t')
  speedLimit: 43,    // AR - Speed Limit
  clue: 44,          // AS - Clue (full instruction)
  lat: 45,           // AT - Lat
  long: 46,          // AU - Long
  firstCar: 47,      // AV - First car time
  lastCar: 48,       // AW - Last car time
  // CI-CL: Time Add columns
  addTimeA: 86,      // CI - Time Add A
  addTimeB: 87,      // CJ - Time Add B
  addTimeC: 88,      // CK - Time Add C
  addTimeD: 89,      // CL - Time Add D
} as const;

// ---------------------------------------------------------------------------
// Route sheet parser
// ---------------------------------------------------------------------------

export interface ImportResult {
  sheetName: string;
  rows: RouteRow[];
  warnings: string[];
}

/** Data rows start at row index 4 (0-based) in BB_2025_* sheets. */
const DATA_START_ROW = 4;

export function parseRouteSheet(
  ws: XLSX.WorkSheet,
  sheetName: string,
): ImportResult {
  const warnings: string[] = [];
  const rows: RouteRow[] = [];

  const ref = ws['!ref'];
  if (!ref) {
    warnings.push(`Sheet "${sheetName}" has no data range`);
    return { sheetName, rows, warnings };
  }

  const range = XLSX.utils.decode_range(ref);
  const lastRow = range.e.r;

  // Detect whether this is a main route sheet (has processed section at AE+)
  // by checking for the header "Typ" at AK (col 36) in row 3.
  const typHeader = strCell(ws, 3, PROC.type);
  const isMainFormat = typHeader === 'Typ';

  if (!isMainFormat) {
    warnings.push(
      `Sheet "${sheetName}" does not have the expected header layout (expected "Typ" at col AK row 4). ` +
      `Attempting alternate format.`,
    );
    return parseAlternateRouteSheet(ws, sheetName);
  }

  for (let r = DATA_START_ROW; r <= lastRow; r++) {
    // Read type code from processed section
    const typeStr = strCell(ws, r, PROC.type).toLowerCase().trim();

    // Read clue from processed section (AS), fall back to raw section (L)
    let clue = strCell(ws, r, PROC.clue);
    if (!clue) clue = strCell(ws, r, RAW.clue);

    // Read rally distance
    const rallyDist = numCell(ws, r, PROC.rallyDist) ?? numCell(ws, r, RAW.rallyDist) ?? 0;

    // Skip truly empty padding rows (no type, no clue, no distance)
    if (!typeStr && !clue && rallyDist === 0) {
      // Check if there's at least some data in this row
      const anyData = numCell(ws, r, RAW.currentSurvey) !== null || numCell(ws, r, RAW.avgLat) !== null;
      if (!anyData) continue;
    }

    const row = createEmptyRow();

    // --- Type code ---
    row.type = isValidTypeCode(typeStr) ? typeStr : null;

    // --- Instruction ---
    row.clue = clue;

    // --- BB Page ---
    row.bbPage = numCell(ws, r, PROC.bbPage) ?? numCell(ws, r, RAW.bbPage);

    // --- Terrain & suggested type ---
    const terrainStr = strCell(ws, r, PROC.terrain) || strCell(ws, r, RAW.terrain);
    row.terrain = terrainStr;
    const sugType = strCell(ws, r, PROC.suggestedType).toLowerCase().trim();
    row.suggestedType = isValidTypeCode(sugType) ? sugType : null;
    row.suggestedASpeed = numCell(ws, r, PROC.suggestedASpeed) ?? numCell(ws, r, RAW.suggestedASpeed);

    // --- Rally distance ---
    row.rallyDistance = round(rallyDist, 2);

    // --- Instruction number ---
    row.instructionNumber = numCell(ws, r, PROC.instrNum);

    // --- Speeds / Add-times ---
    if (row.type === 't') {
      // For time-add rows, AN-AQ hold the add-time values
      row.addTimeA = numCell(ws, r, PROC.aSpeed) ?? 0;
      row.addTimeB = numCell(ws, r, PROC.bSpeed) ?? 0;
      row.addTimeC = numCell(ws, r, PROC.cSpeed) ?? 0;
      row.addTimeD = numCell(ws, r, PROC.dSpeed) ?? 0;
      row.aSpeed = 0;
      row.bSpeed = 0;
      row.cSpeed = 0;
      row.dSpeed = 0;
    } else {
      row.aSpeed = numCell(ws, r, PROC.aSpeed) ?? 0;
      row.bSpeed = numCell(ws, r, PROC.bSpeed) ?? 0;
      row.cSpeed = numCell(ws, r, PROC.cSpeed) ?? 0;
      row.dSpeed = numCell(ws, r, PROC.dSpeed) ?? 0;
      // Check CI-CL for add-time even on non-'t' rows
      row.addTimeA = numCell(ws, r, PROC.addTimeA) ?? 0;
      row.addTimeB = numCell(ws, r, PROC.addTimeB) ?? 0;
      row.addTimeC = numCell(ws, r, PROC.addTimeC) ?? 0;
      row.addTimeD = numCell(ws, r, PROC.addTimeD) ?? 0;
    }

    // --- Speed limit ---
    row.speedLimit = numCell(ws, r, PROC.speedLimit) ?? numCell(ws, r, RAW.speedLimit) ?? 60;

    // --- Coordinates (averaged/final values from processed section) ---
    row.lat = numCell(ws, r, PROC.lat) ?? numCell(ws, r, RAW.avgLat) ?? 0;
    row.long = numCell(ws, r, PROC.long) ?? numCell(ws, r, RAW.avgLong) ?? 0;

    // --- Current survey check values ---
    row.checkDist = numCell(ws, r, RAW.currentSurvey);
    row.checkLat = numCell(ws, r, RAW.currLat);
    row.checkLong = numCell(ws, r, RAW.currLong);

    // --- Distance history (preserve all survey cycles) ---
    row.distanceHistory = buildDistanceHistory(ws, r);

    // --- Coordinate history (preserve all survey cycles) ---
    row.latHistory = buildCoordHistory(ws, r, [RAW.prev3Lat, RAW.prev2Lat, RAW.prev1Lat, RAW.currLat]);
    row.longHistory = buildCoordHistory(ws, r, [RAW.prev3Long, RAW.prev2Long, RAW.prev1Long, RAW.currLong]);

    // --- First/Last car times ---
    const firstRaw = numCell(ws, r, PROC.firstCar);
    const lastRaw = numCell(ws, r, PROC.lastCar);
    row.firstCarTime = firstRaw != null ? excelFractionToTime(firstRaw) : '';
    row.lastCarTime = lastRaw != null ? excelFractionToTime(lastRaw) : '';

    // Mark as verified since this is historical data
    row.verified = true;

    rows.push(row);
  }

  return { sheetName, rows, warnings };
}

// ---------------------------------------------------------------------------
// History builders
// ---------------------------------------------------------------------------

/**
 * Build distanceHistory from previous survey columns.
 * Previous surveys: #3 (oldest, cols S/T), #2 (cols Q/R), #1 (cols O/P), current (col I).
 * We use the "Adj" (adjusted) columns (P, R, T) when available, falling back to "Raw" (O, Q, S).
 */
function buildDistanceHistory(ws: XLSX.WorkSheet, r: number): ReconEntry[] {
  const history: ReconEntry[] = [];

  // Survey #3 (oldest) - cols S(18)/T(19)
  const s3 = numCell(ws, r, RAW.prev3Adj) ?? numCell(ws, r, RAW.prev3Raw);
  if (s3 != null && s3 !== 0) {
    history.push({ value: round(s3, 5), date: 'Survey #3' });
  }

  // Survey #2 - cols Q(16)/R(17)
  const s2 = numCell(ws, r, RAW.prev2Adj) ?? numCell(ws, r, RAW.prev2Raw);
  if (s2 != null && s2 !== 0) {
    history.push({ value: round(s2, 5), date: 'Survey #2' });
  }

  // Survey #1 - cols O(14)/P(15)
  const s1 = numCell(ws, r, RAW.prev1Adj) ?? numCell(ws, r, RAW.prev1Raw);
  if (s1 != null && s1 !== 0) {
    history.push({ value: round(s1, 5), date: 'Survey #1' });
  }

  // Current survey - col I(8)
  const curr = numCell(ws, r, RAW.currentSurvey);
  if (curr != null && curr !== 0) {
    history.push({ value: round(curr, 5), date: 'Current Survey' });
  }

  return history;
}

/**
 * Build coordinate history from previous survey columns.
 * @param cols Column indices ordered oldest to newest (e.g. [prev3, prev2, prev1, current]).
 */
function buildCoordHistory(ws: XLSX.WorkSheet, r: number, cols: readonly number[]): ReconEntry[] {
  const labels = ['Survey #3', 'Survey #2', 'Survey #1', 'Current Survey'];
  const history: ReconEntry[] = [];

  for (let i = 0; i < cols.length; i++) {
    const v = numCell(ws, r, cols[i]);
    if (v != null && v !== 0) {
      history.push({ value: round(v, 8), date: labels[i] ?? `Survey ${i}` });
    }
  }

  return history;
}

// ---------------------------------------------------------------------------
// Excel time fraction → HH:MM:SS
// ---------------------------------------------------------------------------

function excelFractionToTime(fraction: number): string {
  const totalSeconds = Math.round(fraction * 86400);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Alternate route sheet parser
// ---------------------------------------------------------------------------

/**
 * Alternate route sheets have a different column layout (no BB Pg, BB P2 columns).
 * Header row is at row 3. Column mapping detected from headers.
 */
function parseAlternateRouteSheet(
  ws: XLSX.WorkSheet,
  sheetName: string,
): ImportResult {
  const warnings: string[] = [];
  const rows: RouteRow[] = [];

  const ref = ws['!ref'];
  if (!ref) return { sheetName, rows, warnings };

  const range = XLSX.utils.decode_range(ref);

  // Build header map from row 3
  const headerMap: Record<string, number> = {};
  for (let c = 0; c <= range.e.c; c++) {
    const h = strCell(ws, 3, c).trim();
    if (h) headerMap[h] = c;
  }

  const col = (name: string): number => headerMap[name] ?? -1;

  for (let r = DATA_START_ROW; r <= range.e.r; r++) {
    const typeCol = col('Typ');
    const typeStr = typeCol >= 0 ? strCell(ws, r, typeCol).toLowerCase().trim() : '';
    const clueCol = col('Clue');
    const clue = clueCol >= 0 ? strCell(ws, r, clueCol) : '';
    const distCol = col('Rally dist');
    const dist = distCol >= 0 ? (numCell(ws, r, distCol) ?? 0) : 0;

    if (!typeStr && !clue && dist === 0) continue;

    const row = createEmptyRow();
    row.type = isValidTypeCode(typeStr) ? typeStr : null;
    row.clue = clue;
    row.rallyDistance = round(dist, 2);

    const terrCol = col('Terrain');
    if (terrCol >= 0) row.terrain = strCell(ws, r, terrCol);

    const sugTypCol = col('Sugg. Typ');
    if (sugTypCol >= 0) {
      const st = strCell(ws, r, sugTypCol).toLowerCase().trim();
      row.suggestedType = isValidTypeCode(st) ? st : null;
    }

    const sugAspCol = col('Sugg. Asp');
    if (sugAspCol >= 0) row.suggestedASpeed = numCell(ws, r, sugAspCol);

    const instrCol = col('Instr. Num.');
    if (instrCol >= 0) row.instructionNumber = numCell(ws, r, instrCol);

    // Speeds / add-times
    const aSpCol = col('A Sp');
    const bSpCol = col('B Sp');
    const cSpCol = col('C Sp');
    const dSpCol = col('D Sp');

    if (row.type === 't') {
      row.addTimeA = aSpCol >= 0 ? (numCell(ws, r, aSpCol) ?? 0) : 0;
      row.addTimeB = bSpCol >= 0 ? (numCell(ws, r, bSpCol) ?? 0) : 0;
      row.addTimeC = cSpCol >= 0 ? (numCell(ws, r, cSpCol) ?? 0) : 0;
      row.addTimeD = dSpCol >= 0 ? (numCell(ws, r, dSpCol) ?? 0) : 0;
    } else {
      row.aSpeed = aSpCol >= 0 ? (numCell(ws, r, aSpCol) ?? 0) : 0;
      row.bSpeed = bSpCol >= 0 ? (numCell(ws, r, bSpCol) ?? 0) : 0;
      row.cSpeed = cSpCol >= 0 ? (numCell(ws, r, cSpCol) ?? 0) : 0;
      row.dSpeed = dSpCol >= 0 ? (numCell(ws, r, dSpCol) ?? 0) : 0;
    }

    const latCol = col('Lat');
    const longCol = col('Long');
    if (latCol >= 0) row.lat = numCell(ws, r, latCol) ?? 0;
    if (longCol >= 0) row.long = numCell(ws, r, longCol) ?? 0;

    // Raw survey data from Section 1 (same column positions)
    row.checkDist = numCell(ws, r, RAW.currentSurvey);
    row.checkLat = numCell(ws, r, RAW.currLat);
    row.checkLong = numCell(ws, r, RAW.currLong);
    row.distanceHistory = buildDistanceHistory(ws, r);
    row.latHistory = buildCoordHistory(ws, r, [RAW.prev3Lat, RAW.prev2Lat, RAW.prev1Lat, RAW.currLat]);
    row.longHistory = buildCoordHistory(ws, r, [RAW.prev3Long, RAW.prev2Long, RAW.prev1Long, RAW.currLong]);

    row.verified = true;
    rows.push(row);
  }

  return { sheetName, rows, warnings };
}

// ---------------------------------------------------------------------------
// Speed table parsers
// ---------------------------------------------------------------------------

export function parseSpeedSheets(
  wb: XLSX.WorkBook,
  sheetNames: string[],
): { entries: SpeedLookupEntry[]; warnings: string[] } {
  const entries: SpeedLookupEntry[] = [];
  const warnings: string[] = [];

  for (const name of sheetNames) {
    const typeCode = SPEED_SHEET_MAP[name];
    if (!typeCode) {
      warnings.push(`Unknown speed sheet: "${name}"`);
      continue;
    }

    const ws = wb.Sheets[name];
    if (!ws) {
      warnings.push(`Speed sheet "${name}" not found`);
      continue;
    }

    const json = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });

    for (const row of json) {
      const a = Number(row[0]);
      const b = Number(row[1]);
      const c = Number(row[2]);
      const d = Number(row[3]);

      // Skip header rows, empty rows, and rows without all 4 speed values
      if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) continue;
      // Skip the zero baseline row (all zeros)
      if (a === 0 && b === 0 && c === 0 && d === 0) continue;

      entries.push({
        terrain: typeCode,
        type: typeCode,
        aSpeed: a,
        bSpeed: b,
        cSpeed: c,
        dSpeed: d,
      });
    }
  }

  return { entries, warnings };
}

export function parseTimeAddSheet(
  ws: XLSX.WorkSheet,
): { entries: TimeAddLookupEntry[]; warnings: string[] } {
  const entries: TimeAddLookupEntry[] = [];
  const warnings: string[] = [];

  const json = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });

  for (const row of json) {
    const a = Number(row[0]);
    const b = Number(row[1]);
    const c = Number(row[2]);
    const d = Number(row[3]);

    if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) continue;
    if (a === 0 && b === 0 && c === 0 && d === 0) continue;

    entries.push({
      addTimeA: a,
      addTimeB: b,
      addTimeC: c,
      addTimeD: d,
    });
  }

  return { entries, warnings };
}

// ---------------------------------------------------------------------------
// Sheet info for the selection dialog
// ---------------------------------------------------------------------------

export interface SheetInfo {
  name: string;
  rowCount: number;
  category: 'route' | 'alternate' | 'speed' | 'timeAdd';
}

export function getSheetInfoList(
  wb: XLSX.WorkBook,
  categories: SheetCategory,
): SheetInfo[] {
  const infos: SheetInfo[] = [];

  const addInfo = (name: string, category: SheetInfo['category']) => {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) {
      infos.push({ name, rowCount: 0, category });
      return;
    }
    const range = XLSX.utils.decode_range(ws['!ref']);
    // Subtract header rows (4 for route sheets, 1-2 for speed/timeAdd)
    const headerRows = category === 'route' || category === 'alternate' ? DATA_START_ROW : 2;
    const dataRows = Math.max(0, range.e.r + 1 - headerRows);
    infos.push({ name, rowCount: dataRows, category });
  };

  for (const name of categories.routeSheets) addInfo(name, 'route');
  for (const name of categories.alternateSheets) addInfo(name, 'alternate');
  for (const name of categories.speedSheets) addInfo(name, 'speed');
  if (categories.timeAddSheet) addInfo(categories.timeAddSheet, 'timeAdd');

  return infos;
}
