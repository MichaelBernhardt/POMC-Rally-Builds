/**
 * Generates a template Excel file (.xlsx) that shows the client
 * the exact column format needed to import nodes.
 */

import * as XLSX from 'xlsx';

const HEADERS = [
  'Rally Dist',
  'Typ',
  'Instruction',
  'A Sp',
  'B Sp',
  'C Sp',
  'D Sp',
  'Limit',
  'Lat',
  'Long',
  'Terrain',
  'Instr. Num.',
  'BB Pg',
  'Sugg. Typ',
  'Sugg. A Sp',
  'Add A',
  'Add B',
  'Add C',
  'Add D',
  'Check Dist',
  'Check Lat',
  'Check Long',
  'Survey 1 Dist',
  'Survey 2 Dist',
  'Survey 3 Dist',
  'Survey 1 Lat',
  'Survey 2 Lat',
  'Survey 3 Lat',
  'Survey 1 Long',
  'Survey 2 Long',
  'Survey 3 Long',
];

/* eslint-disable @typescript-eslint/no-explicit-any */
const E = ''; // empty cell shorthand

const EXAMPLE_ROWS: any[][] = [
  //  RDist  Typ  Instruction                                    ASp BSp CSp DSp  Lim   Lat       Long     Terr  Instr BB  STyp SASp  AddA-D              ChkDist ChkLat    ChkLong   S1Dist S2Dist S3Dist S1Lat S2Lat S3Lat S1Long S2Long S3Long
  [   0.00, 'o', 'Start of regularity. Turn RIGHT onto R40.',    30, 30, 30, 30,  60, -25.049,  31.089,   'F',   1,  488, 'o',  30,  E,  E,  E,  E,   0.00,  -25.049,  31.089,    0.01,  0.00,   E,   -25.049, -25.050, E,  31.089, 31.088, E],
  [   1.25, 'o', 'Traffic light. Carry straight on.',             30, 30, 30, 30,  60,   E,       E,       'F',   2,  488,  E,    E,   E,  E,  E,  E,   1.26,   E,        E,         1.24,  1.25,   E,    E,       E,      E,   E,      E,     E],
  [   2.50, 'f', 'Bridge. Continue straight.',                    35, 30, 30, 30,  60,   E,       E,       'FU',  3,  488, 'f',  35,  E,  E,  E,  E,    E,      E,        E,          E,     E,     E,    E,       E,      E,   E,      E,     E],
  [   5.00, 'm', 'Control @ entrance to farm. Sign on left.',     0,  0,  0,  0,  60, -25.012,  31.035,    E,    4,  488,  E,    E,   E,  E,  E,  E,   5.01,  -25.012,  31.036,      E,     E,     E,   -25.013,  E,     E,  31.035,  E,     E],
  [   5.10, 't', 'Time addition — rough road section.',            0,  0,  0,  0,  60,   E,       E,        E,    5,  488,  E,    E,   2,  2,  3,  3,    E,      E,        E,          E,     E,     E,    E,       E,      E,   E,      E,     E],
  [   7.80, 'l', 'Speed limit zone. 40 km/h.',                   40, 35, 35, 35,  40,   E,       E,       'F',   6,  488, 'l',  40,  E,  E,  E,  E,   7.81,   E,        E,         7.79,  7.80,   E,    E,       E,      E,   E,      E,     E],
];

const NOTES_SHEET = [
  ['Column', 'Required', 'Description'],
  [],
  ['CORE COLUMNS'],
  ['Rally Dist', 'Yes', 'Cumulative rally distance in km (e.g. 0.00, 1.25, 5.00)'],
  ['Typ', 'Yes', 'Type code: o=Open, f=Flat, d=Downhill, u=Uphill, l=Speed Limit, m=Marked Control, t=Time Add'],
  ['Instruction', 'Yes', 'Route instruction / clue text'],
  ['A Sp', 'Yes', 'Speed group A (km/h). Use 0 for type m and t.'],
  ['B Sp', 'Yes', 'Speed group B (km/h)'],
  ['C Sp', 'Yes', 'Speed group C (km/h)'],
  ['D Sp', 'Yes', 'Speed group D (km/h)'],
  ['Limit', 'No', 'Road speed limit (km/h). Defaults to 60 if blank.'],
  ['Lat', 'No', 'GPS Latitude (decimal degrees). Required for type m (marked control).'],
  ['Long', 'No', 'GPS Longitude (decimal degrees). Required for type m (marked control).'],
  ['Terrain', 'No', 'Terrain description: F=Flat, U=Uphill, D=Downhill, FU=Flat/Uphill, etc.'],
  ['Instr. Num.', 'No', 'Instruction sequence number'],
  ['BB Pg', 'No', 'Blackbook page reference number'],
  ['Sugg. Typ', 'No', 'Suggested type code from reconnaissance (o/f/d/u/l/m/t)'],
  ['Sugg. A Sp', 'No', 'Suggested A-speed from reconnaissance (km/h)'],
  [],
  ['TIME-ADD COLUMNS (used with type t)'],
  ['Add A', 'No', 'Added time for group A (minutes)'],
  ['Add B', 'No', 'Added time for group B (minutes)'],
  ['Add C', 'No', 'Added time for group C (minutes)'],
  ['Add D', 'No', 'Added time for group D (minutes)'],
  [],
  ['RECONNAISSANCE CHECK COLUMNS'],
  ['Check Dist', 'No', 'Measured distance during reconnaissance (km)'],
  ['Check Lat', 'No', 'Measured GPS latitude during reconnaissance'],
  ['Check Long', 'No', 'Measured GPS longitude during reconnaissance'],
  [],
  ['SURVEY HISTORY (previous survey distance/coordinate readings)'],
  ['Survey 1 Dist', 'No', 'Distance reading from survey #1 (most recent previous survey)'],
  ['Survey 2 Dist', 'No', 'Distance reading from survey #2'],
  ['Survey 3 Dist', 'No', 'Distance reading from survey #3 (oldest)'],
  ['Survey 1 Lat', 'No', 'Latitude reading from survey #1'],
  ['Survey 2 Lat', 'No', 'Latitude reading from survey #2'],
  ['Survey 3 Lat', 'No', 'Latitude reading from survey #3'],
  ['Survey 1 Long', 'No', 'Longitude reading from survey #1'],
  ['Survey 2 Long', 'No', 'Longitude reading from survey #2'],
  ['Survey 3 Long', 'No', 'Longitude reading from survey #3'],
  [],
  ['INSTRUCTIONS'],
  ['- Each sheet in this workbook becomes one Node in the rally planner.'],
  ['- Rename each sheet to the node name you want (e.g. "Stage 1", "Transit A").'],
  ['- The first sheet imported will be set as the Start Node.'],
  ['- Subsequent sheets will be chained in order.'],
  ['- Delete this "Notes" sheet before importing — it will be skipped if present.'],
  ['- You only need the core columns (Rally Dist, Typ, Instruction, speeds).'],
  ['- All other columns are optional — leave blank or remove if not needed.'],
];

export function generateNodeImportTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Example node sheet
  const exampleData = [HEADERS, ...EXAMPLE_ROWS];
  const ws1 = XLSX.utils.aoa_to_sheet(exampleData);
  ws1['!cols'] = [
    { wch: 10 }, // Rally Dist
    { wch: 5 },  // Typ
    { wch: 45 }, // Instruction
    { wch: 6 },  // A Sp
    { wch: 6 },  // B Sp
    { wch: 6 },  // C Sp
    { wch: 6 },  // D Sp
    { wch: 6 },  // Limit
    { wch: 12 }, // Lat
    { wch: 12 }, // Long
    { wch: 8 },  // Terrain
    { wch: 10 }, // Instr. Num.
    { wch: 6 },  // BB Pg
    { wch: 9 },  // Sugg. Typ
    { wch: 10 }, // Sugg. A Sp
    { wch: 6 },  // Add A
    { wch: 6 },  // Add B
    { wch: 6 },  // Add C
    { wch: 6 },  // Add D
    { wch: 10 }, // Check Dist
    { wch: 12 }, // Check Lat
    { wch: 12 }, // Check Long
    { wch: 12 }, // Survey 1 Dist
    { wch: 12 }, // Survey 2 Dist
    { wch: 12 }, // Survey 3 Dist
    { wch: 12 }, // Survey 1 Lat
    { wch: 12 }, // Survey 2 Lat
    { wch: 12 }, // Survey 3 Lat
    { wch: 12 }, // Survey 1 Long
    { wch: 12 }, // Survey 2 Long
    { wch: 12 }, // Survey 3 Long
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Example Node');

  // Blank second node sheet (just headers)
  const ws2 = XLSX.utils.aoa_to_sheet([HEADERS]);
  ws2['!cols'] = ws1['!cols'];
  XLSX.utils.book_append_sheet(wb, ws2, 'Node 2');

  // Notes sheet
  const wsNotes = XLSX.utils.aoa_to_sheet(NOTES_SHEET);
  wsNotes['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Notes');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}
