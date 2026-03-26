import { RouteRow, SpeedGroupSettings } from '../../types/domain';
import { computeTimes } from '../timeCalculator';
import { getExportableRows, getExportType } from './reportDataTransformer';
import {
  createPdfDocument,
  renderPageHeader,
  getBaseTableOptions,
  autoTable,
  pdfToBytes,
} from './pdfHelpers';

export interface CheckScheduleOptions {
  rows: RouteRow[];
  dayName: string;
  rallyName: string;
  startTime: string;
  speedGroupSettings: SpeedGroupSettings;
}

export function generateCheckSchedulePdf(options: CheckScheduleOptions): Uint8Array {
  const { rows, dayName, rallyName, startTime, speedGroupSettings } = options;

  // Recompute times to ensure freshness
  const timedRows = computeTimes(rows, startTime, speedGroupSettings);
  const exportRows = getExportableRows(timedRows);

  const doc = createPdfDocument();
  const baseOpts = getBaseTableOptions(doc);

  const tableData = exportRows.map((row, i) => {
    const isControl = row.type === 'm';
    return [
      i + 1,                                  // No
      row.rallyDistance.toFixed(2),            // Dist
      row.aSpeed,                             // Asp
      row.bSpeed,                             // Bsp
      row.cSpeed,                             // Csp
      row.dSpeed,                             // Dsp
      row.firstCarTime,                       // First
      row.lastCarTime,                        // Last
      isControl ? row.lat.toFixed(6) : '',    // Lat
      isControl ? row.long.toFixed(6) : '',   // Long
      row.clue,                               // Instruction (keep {} annotations)
      getExportType(row.type!),               // t
    ];
  });

  autoTable(doc, {
    ...baseOpts,
    head: [['No', 'Dist', 'Asp', 'Bsp', 'Csp', 'Dsp', 'First', 'Last', 'Lat', 'Long', 'Instruction', 't']],
    body: tableData,
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },   // No
      1: { cellWidth: 14 },                      // Dist
      2: { cellWidth: 10, halign: 'center' },    // Asp
      3: { cellWidth: 10, halign: 'center' },    // Bsp
      4: { cellWidth: 10, halign: 'center' },    // Csp
      5: { cellWidth: 10, halign: 'center' },    // Dsp
      6: { cellWidth: 18 },                      // First
      7: { cellWidth: 18 },                      // Last
      8: { cellWidth: 22 },                      // Lat
      9: { cellWidth: 22 },                      // Long
      10: { cellWidth: 'auto' },                 // Instruction
      11: { cellWidth: 8, halign: 'center' },    // t
    },
    didDrawPage: (data) => {
      baseOpts.didDrawPage?.(data);
      renderPageHeader(doc, dayName, rallyName, 'Check');
    },
  });

  return pdfToBytes(doc);
}
