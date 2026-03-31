/**
 * Generic node importer — parses a simple Excel format where each sheet
 * is one node. Header row 1 maps columns to RouteRow fields.
 */

import * as XLSX from 'xlsx';
import {
  RouteRow,
  ReconEntry,
  TypeCode,
  TYPE_CODES,
  createEmptyRow,
} from '../types/domain';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKIP_SHEETS = ['notes'];

function isValidTypeCode(v: string): v is TypeCode {
  return TYPE_CODES.includes(v as TypeCode);
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface NodeSheetInfo {
  name: string;
  rowCount: number;
}

export function getNodeSheetInfoList(wb: XLSX.WorkBook): NodeSheetInfo[] {
  return wb.SheetNames
    .filter(name => !SKIP_SHEETS.includes(name.toLowerCase()))
    .map(name => {
      const ws = wb.Sheets[name];
      if (!ws || !ws['!ref']) return { name, rowCount: 0 };
      const range = XLSX.utils.decode_range(ws['!ref']);
      return { name, rowCount: Math.max(0, range.e.r) }; // subtract header row
    });
}

export interface NodeImportResult {
  sheets: { name: string; rows: RouteRow[] }[];
  warnings: string[];
}

export function parseNodeSheets(
  wb: XLSX.WorkBook,
  selectedSheets: string[],
): NodeImportResult {
  const warnings: string[] = [];
  const sheets: { name: string; rows: RouteRow[] }[] = [];

  for (const sheetName of selectedSheets) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      warnings.push(`Sheet "${sheetName}" not found.`);
      continue;
    }

    const ref = ws['!ref'];
    if (!ref) {
      warnings.push(`Sheet "${sheetName}" is empty.`);
      continue;
    }

    const range = XLSX.utils.decode_range(ref);

    // Build header map from row 0
    const colMap: Record<string, number> = {};
    for (let c = 0; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) {
        const header = String(cell.v).trim().toLowerCase();
        colMap[header] = c;
      }
    }

    // Check required columns
    const missing: string[] = [];
    for (const req of ['rally dist', 'typ', 'instruction']) {
      if (!(req in colMap)) missing.push(req);
    }
    if (missing.length > 0) {
      warnings.push(`Sheet "${sheetName}": missing required columns: ${missing.join(', ')}.`);
      continue;
    }

    const rows: RouteRow[] = [];
    for (let r = 1; r <= range.e.r; r++) {
      const getNum = (col: number): number | null => {
        const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
        if (!cell || cell.v === '' || cell.v == null) return null;
        const v = Number(cell.v);
        return isNaN(v) ? null : v;
      };
      const getStr = (col: number): string => {
        const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
        if (!cell) return '';
        return String(cell.v);
      };
      const readNum = (header: string, fallback: number): number => {
        const col = colMap[header];
        if (col == null) return fallback;
        return getNum(col) ?? fallback;
      };
      const readOptNum = (header: string): number | null => {
        const col = colMap[header];
        if (col == null) return null;
        return getNum(col);
      };

      // Read type
      const typeCol = colMap['typ'];
      const typeStr = typeCol != null ? getStr(typeCol).toLowerCase().trim() : '';

      // Read instruction
      const clueCol = colMap['instruction'];
      const clue = clueCol != null ? getStr(clueCol) : '';

      // Read distance
      const distCol = colMap['rally dist'];
      const dist = distCol != null ? (getNum(distCol) ?? 0) : 0;

      // Skip completely empty rows
      if (!typeStr && !clue && dist === 0) continue;

      const row = createEmptyRow();

      row.type = isValidTypeCode(typeStr) ? typeStr : null;
      row.clue = clue;
      row.rallyDistance = round(dist, 2);

      if (typeStr && !isValidTypeCode(typeStr)) {
        warnings.push(`Sheet "${sheetName}" row ${r + 1}: invalid type "${typeStr}".`);
      }

      // --- Speeds / add-times ---
      if (row.type === 't') {
        row.addTimeA = readNum('a sp', 0);
        row.addTimeB = readNum('b sp', 0);
        row.addTimeC = readNum('c sp', 0);
        row.addTimeD = readNum('d sp', 0);
      } else {
        row.aSpeed = readNum('a sp', 0);
        row.bSpeed = readNum('b sp', 0);
        row.cSpeed = readNum('c sp', 0);
        row.dSpeed = readNum('d sp', 0);
      }

      row.speedLimit = readNum('limit', 60);

      // --- Coordinates ---
      row.lat = readNum('lat', 0);
      row.long = readNum('long', 0);

      // --- Terrain ---
      const terrainCol = colMap['terrain'];
      if (terrainCol != null) row.terrain = getStr(terrainCol);

      // --- Metadata ---
      row.bbPage = readOptNum('bb pg');
      row.instructionNumber = readOptNum('instr. num.');

      const sugTypCol = colMap['sugg. typ'];
      if (sugTypCol != null) {
        const st = getStr(sugTypCol).toLowerCase().trim();
        row.suggestedType = isValidTypeCode(st) ? st : null;
      }
      row.suggestedASpeed = readOptNum('sugg. a sp');

      // --- Explicit add-time columns (for non-'t' rows) ---
      if (row.type !== 't') {
        row.addTimeA = readNum('add a', 0);
        row.addTimeB = readNum('add b', 0);
        row.addTimeC = readNum('add c', 0);
        row.addTimeD = readNum('add d', 0);
      }

      // --- Recon check values ---
      row.checkDist = readOptNum('check dist');
      row.checkLat = readOptNum('check lat');
      row.checkLong = readOptNum('check long');

      // --- Survey history ---
      row.distanceHistory = buildHistory(readOptNum, [
        ['survey 1 dist', 'Survey #1'],
        ['survey 2 dist', 'Survey #2'],
        ['survey 3 dist', 'Survey #3'],
      ]);
      row.latHistory = buildHistory(readOptNum, [
        ['survey 1 lat', 'Survey #1'],
        ['survey 2 lat', 'Survey #2'],
        ['survey 3 lat', 'Survey #3'],
      ]);
      row.longHistory = buildHistory(readOptNum, [
        ['survey 1 long', 'Survey #1'],
        ['survey 2 long', 'Survey #2'],
        ['survey 3 long', 'Survey #3'],
      ]);

      row.verified = true;
      rows.push(row);
    }

    if (rows.length === 0) {
      warnings.push(`Sheet "${sheetName}" has no data rows.`);
    } else {
      sheets.push({ name: sheetName, rows });
    }
  }

  return { sheets, warnings };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHistory(
  readOptNum: (header: string) => number | null,
  entries: [header: string, label: string][],
): ReconEntry[] {
  const history: ReconEntry[] = [];
  for (const [header, label] of entries) {
    const v = readOptNum(header);
    if (v != null && v !== 0) {
      history.push({ value: round(v, 8), date: label });
    }
  }
  return history;
}
