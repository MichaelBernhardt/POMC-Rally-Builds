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
  'Add A',
  'Add B',
  'Add C',
  'Add D',
];

const EXAMPLE_ROWS = [
  [0.00, 'o', 'Start of regularity. Turn RIGHT onto R40.', 30, 30, 30, 30, 60, -25.049, 31.089, 'F', '', '', '', ''],
  [1.25, 'o', 'Traffic light. Carry straight on.', 30, 30, 30, 30, 60, '', '', 'F', '', '', '', ''],
  [2.50, 'f', 'Bridge. Continue straight.', 35, 30, 30, 30, 60, '', '', 'FU', '', '', '', ''],
  [5.00, 'm', 'Control @ entrance to farm. Sign on left.', 0, 0, 0, 0, 60, -25.012, 31.035, '', '', '', '', ''],
  [5.10, 't', 'Time addition — rough road section.', 0, 0, 0, 0, 60, '', '', '', 2, 2, 3, 3],
  [7.80, 'l', 'Speed limit zone. 40 km/h.', 40, 35, 35, 35, 40, '', '', 'F', '', '', '', ''],
];

const NOTES_SHEET = [
  ['Column', 'Required', 'Description'],
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
  ['Add A', 'No', 'Added time for group A (minutes). Used with type t.'],
  ['Add B', 'No', 'Added time for group B (minutes)'],
  ['Add C', 'No', 'Added time for group C (minutes)'],
  ['Add D', 'No', 'Added time for group D (minutes)'],
  [],
  ['INSTRUCTIONS'],
  ['- Each sheet in this workbook becomes one Node in the rally planner.'],
  ['- Rename each sheet to the node name you want (e.g. "Stage 1", "Transit A").'],
  ['- The first sheet imported will be set as the Start Node.'],
  ['- Subsequent sheets will be chained in order.'],
  ['- Delete this "Notes" sheet before importing — it will be skipped if present.'],
];

export function generateNodeImportTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new();

  // Example node sheet
  const exampleData = [HEADERS, ...EXAMPLE_ROWS];
  const ws1 = XLSX.utils.aoa_to_sheet(exampleData);
  // Set column widths
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
    { wch: 6 },  // Add A
    { wch: 6 },  // Add B
    { wch: 6 },  // Add C
    { wch: 6 },  // Add D
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Example Node');

  // Blank second node sheet (just headers)
  const ws2 = XLSX.utils.aoa_to_sheet([HEADERS]);
  ws2['!cols'] = ws1['!cols'];
  XLSX.utils.book_append_sheet(wb, ws2, 'Node 2');

  // Notes sheet
  const wsNotes = XLSX.utils.aoa_to_sheet(NOTES_SHEET);
  wsNotes['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Notes');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}
