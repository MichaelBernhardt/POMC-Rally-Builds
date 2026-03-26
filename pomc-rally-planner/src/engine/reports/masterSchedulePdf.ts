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

export interface MasterScheduleOptions {
  rows: RouteRow[];
  dayName: string;
  rallyName: string;
  startTime: string;
  speedGroupSettings: SpeedGroupSettings;
}

export function generateMasterSchedulePdf(options: MasterScheduleOptions): Uint8Array {
  const { rows, dayName, rallyName, startTime, speedGroupSettings } = options;

  // Recompute times to ensure freshness
  const timedRows = computeTimes(rows, startTime, speedGroupSettings);
  const exportRows = getExportableRows(timedRows);

  const doc = createPdfDocument();
  const baseOpts = getBaseTableOptions(doc);

  const tableData = exportRows.map((row, i) => [
    i + 1,                                  // No
    row.rallyDistance.toFixed(2),            // Dist
    row.aSpeed,                             // Asp
    row.bSpeed,                             // Bsp
    row.cSpeed,                             // Csp
    row.dSpeed,                             // Dsp
    row.firstCarTime,                       // First
    row.lastCarTime,                        // Last
    row.clue,                               // Instruction (keep {} annotations)
    getExportType(row.type!),               // t
  ]);

  autoTable(doc, {
    ...baseOpts,
    head: [['No', 'Dist', 'Asp', 'Bsp', 'Csp', 'Dsp', 'First', 'Last', 'Instruction', 't']],
    body: tableData,
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },  // No
      1: { cellWidth: 16 },                     // Dist
      2: { cellWidth: 12, halign: 'center' },   // Asp
      3: { cellWidth: 12, halign: 'center' },   // Bsp
      4: { cellWidth: 12, halign: 'center' },   // Csp
      5: { cellWidth: 12, halign: 'center' },   // Dsp
      6: { cellWidth: 22 },                     // First
      7: { cellWidth: 22 },                     // Last
      8: { cellWidth: 'auto' },                 // Instruction (takes remaining width)
      9: { cellWidth: 10, halign: 'center' },   // t
    },
    didDrawPage: (data) => {
      // Call the base didDrawPage for footer
      baseOpts.didDrawPage?.(data);
      // Add header
      renderPageHeader(doc, dayName, rallyName, 'Master');
    },
  });

  return pdfToBytes(doc);
}
