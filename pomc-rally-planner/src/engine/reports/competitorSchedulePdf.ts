import { RouteRow, SpeedGroupSettings } from '../../types/domain';
import { computeCumulativeForGroup } from '../timeCalculator';
import {
  getCompetitorRows,
  getSpeedForGroup,
  computeHeadlineSpeed,
  formatDayDate,
  formatCompetitorInstruction,
  groupLabel,
} from './reportDataTransformer';
import {
  createPdfDocumentPortrait,
  renderPageHeader,
  getBaseTableOptions,
  autoTable,
  pdfToBytes,
  formatHoursToHMS,
} from './pdfHelpers';

export interface CompetitorScheduleOptions {
  rows: RouteRow[];
  group: 'a' | 'b' | 'c' | 'd';
  dayName: string;
  rallyName: string;
  dayDate?: string;
  startTime: string;
  speedGroupSettings: SpeedGroupSettings;
}

export function generateCompetitorSchedulePdf(options: CompetitorScheduleOptions): Uint8Array {
  const { rows, group, dayName, rallyName, dayDate, startTime, speedGroupSettings } = options;

  // Compute cumulative travel times for ALL rows (needed for correct index mapping)
  const cumulativeTimes = computeCumulativeForGroup(rows, group);

  // Filter to competitor rows (exclude controls) and map their indices back
  const competitorRows: { row: RouteRow; cumulativeHours: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.type !== null && row.type !== 'm') {
      competitorRows.push({ row, cumulativeHours: cumulativeTimes[i] });
    }
  }

  const headlineSpeed = computeHeadlineSpeed(rows, group);
  const dateStr = dayDate ? formatDayDate(dayDate) : '';
  const centerText = `${rallyName} - ${dayName}`;
  const rightText = `${headlineSpeed} km/h (${groupLabel(group)}) Speed Group`;

  const doc = createPdfDocumentPortrait();
  const baseOpts = getBaseTableOptions(doc);

  const tableData = competitorRows.map(({ row, cumulativeHours }) => [
    row.rallyDistance.toFixed(2),                       // Dist
    getSpeedForGroup(row, group),                       // Speed
    formatHoursToHMS(cumulativeHours),                  // Time (zero-based)
    formatCompetitorInstruction(row, group),             // Instruction
  ]);

  autoTable(doc, {
    ...baseOpts,
    head: [['Dist', 'Speed', 'Time', 'Instruction']],
    body: tableData,
    columnStyles: {
      0: { cellWidth: 18 },                 // Dist
      1: { cellWidth: 16, halign: 'center' }, // Speed
      2: { cellWidth: 22 },                 // Time
      3: { cellWidth: 'auto' },             // Instruction (takes remaining)
    },
    didDrawPage: (data) => {
      baseOpts.didDrawPage?.(data);
      renderPageHeader(doc, dateStr, centerText, rightText);
    },
  });

  return pdfToBytes(doc);
}
