/**
 * Generic node importer — parses a simple Excel format where each sheet
 * is one node. Header row 1 maps columns to RouteRow fields.
 */

import * as XLSX from 'xlsx';
import {
  RouteRow,
  TypeCode,
  TYPE_CODES,
  createEmptyRow,
} from '../types/domain';

// ---------------------------------------------------------------------------
// Header → field mapping
// ---------------------------------------------------------------------------

const HEADER_MAP: Record<string, keyof RouteRow> = {
  'rally dist': 'rallyDistance',
  'typ': 'type',
  'instruction': 'clue',
  'a sp': 'aSpeed',
  'b sp': 'bSpeed',
  'c sp': 'cSpeed',
  'd sp': 'dSpeed',
  'limit': 'speedLimit',
  'lat': 'lat',
  'long': 'long',
  'terrain': 'terrain',
  'add a': 'addTimeA',
  'add b': 'addTimeB',
  'add c': 'addTimeC',
  'add d': 'addTimeD',
};

const SKIP_SHEETS = ['notes'];

function isValidTypeCode(v: string): v is TypeCode {
  return TYPE_CODES.includes(v as TypeCode);
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
      row.rallyDistance = Math.round(dist * 100) / 100;

      if (row.type && !isValidTypeCode(typeStr)) {
        warnings.push(`Sheet "${sheetName}" row ${r + 1}: invalid type "${typeStr}".`);
      }

      // Speeds / add-times
      const readSpeed = (header: string, fallback: number): number => {
        const col = colMap[header];
        if (col == null) return fallback;
        return getNum(col) ?? fallback;
      };

      if (row.type === 't') {
        row.addTimeA = readSpeed('a sp', 0);
        row.addTimeB = readSpeed('b sp', 0);
        row.addTimeC = readSpeed('c sp', 0);
        row.addTimeD = readSpeed('d sp', 0);
      } else {
        row.aSpeed = readSpeed('a sp', 0);
        row.bSpeed = readSpeed('b sp', 0);
        row.cSpeed = readSpeed('c sp', 0);
        row.dSpeed = readSpeed('d sp', 0);
      }

      row.speedLimit = readSpeed('limit', 60);
      row.lat = readSpeed('lat', 0);
      row.long = readSpeed('long', 0);

      const terrainCol = colMap['terrain'];
      if (terrainCol != null) row.terrain = getStr(terrainCol);

      // Add-time columns (explicit, in addition to speed column override for type t)
      if (row.type !== 't') {
        row.addTimeA = readSpeed('add a', 0);
        row.addTimeB = readSpeed('add b', 0);
        row.addTimeC = readSpeed('add c', 0);
        row.addTimeD = readSpeed('add d', 0);
      }

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
