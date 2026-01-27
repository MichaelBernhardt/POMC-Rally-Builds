import Papa from 'papaparse';
import { RouteRow, CsvExportRow, TypeCode, TYPE_CODES, createEmptyRow } from '../types/domain';

/**
 * Parse a CSV string into RouteRow[].
 * Supports both "clean" format (sequential numbers) and "blackbook" format (type codes as No).
 */
export function parseCsvToRows(csvText: string): RouteRow[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    console.warn('CSV parse warnings:', result.errors);
  }

  const rows: RouteRow[] = [];

  for (const record of result.data) {
    const no = (record['No'] ?? '').trim();
    const instruction = (record['Instruction'] ?? '').trim();
    const csvType = (record['Type'] ?? '').trim().toLowerCase();
    const distance = parseFloat(record['Distance'] ?? '0') || 0;
    const aSpeed = parseFloat(record['A_Speed'] ?? '0') || 0;
    const bSpeed = parseFloat(record['B_Speed'] ?? '0') || 0;
    const cSpeed = parseFloat(record['C_Speed'] ?? '0') || 0;
    const dSpeed = parseFloat(record['D_Speed'] ?? '0') || 0;
    const limit = parseFloat(record['Limit'] ?? '60') || 60;
    const addTimeA = parseFloat(record['AddTime_A'] ?? '0') || 0;
    const addTimeB = parseFloat(record['AddTime_B'] ?? '0') || 0;
    const addTimeC = parseFloat(record['AddTime_C'] ?? '0') || 0;
    const addTimeD = parseFloat(record['AddTime_D'] ?? '0') || 0;
    const lat = parseFloat(record['Lat'] ?? '0') || 0;
    const long = parseFloat(record['Long'] ?? '0') || 0;

    // Determine the type code
    let typeCode: TypeCode | null = null;

    // Check if No field is a type code (blackbook format)
    if (TYPE_CODES.includes(no.toLowerCase() as TypeCode)) {
      typeCode = no.toLowerCase() as TypeCode;
    } else if (csvType === 'v') {
      typeCode = 'm'; // verification -> marked control
    } else if (csvType === 'a') {
      // Determine specific type from context
      // In clean format, we don't have the original type code,
      // so we infer from the data
      if (addTimeA > 0 || addTimeB > 0 || addTimeC > 0 || addTimeD > 0) {
        typeCode = 't';
      } else if (aSpeed === bSpeed && bSpeed === cSpeed && cSpeed === dSpeed) {
        typeCode = 'o'; // all same speed = open section
      } else {
        typeCode = 'f'; // default to flat for graduated speeds
      }
    }

    const row = createEmptyRow();
    row.rallyDistance = distance;
    row.type = typeCode;
    row.aSpeed = aSpeed;
    row.bSpeed = bSpeed;
    row.cSpeed = cSpeed;
    row.dSpeed = dSpeed;
    row.speedLimit = limit;
    row.clue = instruction;
    row.lat = lat;
    row.long = long;
    row.addTimeA = addTimeA;
    row.addTimeB = addTimeB;
    row.addTimeC = addTimeC;
    row.addTimeD = addTimeD;

    rows.push(row);
  }

  return rows;
}

/**
 * Export rows to "clean" CSV format.
 * Sequential numbering, curly braces stripped from instructions.
 */
export function exportCleanCsv(rows: RouteRow[]): string {
  const exportRows = rows.filter(r => r.type !== null);
  let seqNum = 1;

  const csvRows: CsvExportRow[] = exportRows.map(row => {
    const exportType = row.type === 'm' ? 'v' : 'a';
    const isControl = row.type === 'm';
    const instruction = row.clue.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();

    return {
      No: seqNum++,
      Instruction: instruction,
      Type: exportType,
      Distance: row.rallyDistance,
      A_Speed: row.aSpeed,
      B_Speed: row.bSpeed,
      C_Speed: row.cSpeed,
      D_Speed: row.dSpeed,
      Limit: row.speedLimit,
      AddTime_A: row.type === 't' ? row.addTimeA : 0,
      AddTime_B: row.type === 't' ? row.addTimeB : 0,
      AddTime_C: row.type === 't' ? row.addTimeC : 0,
      AddTime_D: row.type === 't' ? row.addTimeD : 0,
      Lat: isControl ? row.lat : 0,
      Long: isControl ? row.long : 0,
    };
  });

  return Papa.unparse(csvRows, {
    quotes: true,
    columns: [
      'No', 'Instruction', 'Type', 'Distance',
      'A_Speed', 'B_Speed', 'C_Speed', 'D_Speed',
      'Limit', 'AddTime_A', 'AddTime_B', 'AddTime_C', 'AddTime_D',
      'Lat', 'Long',
    ],
  });
}

/**
 * Export rows to "blackbook" CSV format.
 * Type code as No field, curly braces preserved.
 */
export function exportBlackbookCsv(rows: RouteRow[]): string {
  const exportRows = rows.filter(r => r.type !== null);

  const csvRows: CsvExportRow[] = exportRows.map(row => {
    const exportType = row.type === 'm' ? 'v' : 'a';
    const isControl = row.type === 'm';

    return {
      No: row.type ?? '',
      Instruction: row.clue,
      Type: exportType,
      Distance: parseFloat(row.rallyDistance.toFixed(2)),
      A_Speed: row.aSpeed,
      B_Speed: row.bSpeed,
      C_Speed: row.cSpeed,
      D_Speed: row.dSpeed,
      Limit: row.speedLimit,
      AddTime_A: row.type === 't' ? row.addTimeA : 0,
      AddTime_B: row.type === 't' ? row.addTimeB : 0,
      AddTime_C: row.type === 't' ? row.addTimeC : 0,
      AddTime_D: row.type === 't' ? row.addTimeD : 0,
      Lat: isControl ? row.lat : 0,
      Long: isControl ? row.long : 0,
    };
  });

  return Papa.unparse(csvRows, {
    columns: [
      'No', 'Instruction', 'Type', 'Distance',
      'A_Speed', 'B_Speed', 'C_Speed', 'D_Speed',
      'Limit', 'AddTime_A', 'AddTime_B', 'AddTime_C', 'AddTime_D',
      'Lat', 'Long',
    ],
  });
}

/**
 * Export rows to SpeedABCD format (13 columns: Distance, SpeedA-D, TimeA-D, InstructionA-D).
 */
export function exportSpeedAbcdCsv(
  rows: RouteRow[],
  cumulativeTimesA: number[],
  cumulativeTimesB: number[],
  cumulativeTimesC: number[],
  cumulativeTimesD: number[],
): string {
  const exportRows = rows.filter(r => r.type !== null);

  const data = exportRows.map((row, i) => {
    const idx = rows.indexOf(row);
    return {
      Distance: row.rallyDistance,
      Speed_A: row.aSpeed,
      Speed_B: row.bSpeed,
      Speed_C: row.cSpeed,
      Speed_D: row.dSpeed,
      Time_A: cumulativeTimesA[idx] ?? 0,
      Time_B: cumulativeTimesB[idx] ?? 0,
      Time_C: cumulativeTimesC[idx] ?? 0,
      Time_D: cumulativeTimesD[idx] ?? 0,
      Instruction_A: row.clue.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim(),
      Instruction_B: row.clue.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim(),
      Instruction_C: row.clue.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim(),
      Instruction_D: row.clue.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim(),
    };
  });

  return Papa.unparse(data);
}
