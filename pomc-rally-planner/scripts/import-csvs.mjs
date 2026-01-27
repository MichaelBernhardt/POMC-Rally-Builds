#!/usr/bin/env node
/**
 * Parses rally CSV files and generates a .rally.json project file
 * that the POMC Rally Planner app can open.
 */
import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvDir = resolve(__dirname, '../../Old spreedsheets/Other');

const TYPE_CODES = ['o', 'f', 'd', 'u', 'l', 'm', 't'];

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(text) {
  // Strip BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h.trim()] = (fields[idx] ?? '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function csvRowToRouteRow(record, isBlackbook) {
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

  // Skip empty padding rows
  if (!instruction && distance === 0 && aSpeed === 0) return null;

  let typeCode = null;
  if (isBlackbook && TYPE_CODES.includes(no.toLowerCase())) {
    typeCode = no.toLowerCase();
  } else if (csvType === 'v') {
    typeCode = 'm';
  } else if (csvType === 'a') {
    if (addTimeA > 0 || addTimeB > 0 || addTimeC > 0 || addTimeD > 0) {
      typeCode = 't';
    } else if (aSpeed === bSpeed && bSpeed === cSpeed && cSpeed === dSpeed) {
      typeCode = 'o';
    } else {
      typeCode = 'f';
    }
  }

  return {
    id: randomUUID(),
    bbPage: null,
    bbPage2: null,
    terrain: '',
    suggestedType: null,
    suggestedASpeed: null,
    rallyDistance: distance,
    type: typeCode,
    instructionNumber: null,
    aSpeed, bSpeed, cSpeed, dSpeed,
    speedLimit: limit,
    clue: instruction,
    lat, long,
    addTimeA, addTimeB, addTimeC, addTimeD,
    firstCarTime: '',
    lastCarTime: '',
  };
}

// Parse Friday (RS_Data_1.csv - blackbook format with type codes)
console.log('Parsing RS_Data_1.csv (Friday - blackbook format)...');
const fridayCsv = readFileSync(resolve(csvDir, 'RS_Data_1.csv'), 'utf-8');
const fridayRecords = parseCsv(fridayCsv);
const fridayRows = fridayRecords.map(r => csvRowToRouteRow(r, true)).filter(Boolean);
console.log(`  -> ${fridayRows.length} rows`);

// Parse Saturday (RS2_Data_1.csv - clean format with sequential numbers)
console.log('Parsing RS2_Data_1.csv (Saturday - clean format)...');
const saturdayCsv = readFileSync(resolve(csvDir, 'RS2_Data_1.csv'), 'utf-8');
const saturdayRecords = parseCsv(saturdayCsv);
const saturdayRows = saturdayRecords.map(r => csvRowToRouteRow(r, false)).filter(Boolean);
console.log(`  -> ${saturdayRows.length} rows`);

// Build the project
const project = {
  version: 1,
  name: '2024 DJ Rally',
  createdAt: new Date().toISOString(),
  modifiedAt: new Date().toISOString(),
  days: [
    {
      id: randomUUID(),
      name: 'Friday',
      startTime: '08:00:00',
      carIntervalSeconds: 60,
      numberOfCars: 30,
      rows: fridayRows,
    },
    {
      id: randomUUID(),
      name: 'Saturday',
      startTime: '07:00:00',
      carIntervalSeconds: 60,
      numberOfCars: 30,
      rows: saturdayRows,
    },
  ],
  speedLookupTable: [],
};

const outPath = resolve(__dirname, '../2024-DJ-Rally.rally.json');
writeFileSync(outPath, JSON.stringify(project, null, 2));
console.log(`\nProject saved to: ${outPath}`);
console.log(`  Friday:   ${fridayRows.length} rows, ${fridayRows.filter(r => r.type).length} exportable`);
console.log(`  Saturday: ${saturdayRows.length} rows, ${saturdayRows.filter(r => r.type).length} exportable`);
