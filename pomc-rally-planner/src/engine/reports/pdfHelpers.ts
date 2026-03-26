import jsPDF from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';

export { autoTable };

/** Create an A4 landscape PDF document with standard margins */
export function createPdfDocument(): jsPDF {
  return new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
}

/** Create an A4 portrait PDF document */
export function createPdfDocumentPortrait(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

/** Header Y position and font size */
const HEADER_Y = 10;
const HEADER_FONT_SIZE = 10;
const FOOTER_FONT_SIZE = 8;
const FOOTER_MARGIN_BOTTOM = 8;

/** Render a 3-part page header: left, center, right */
export function renderPageHeader(
  doc: jsPDF,
  leftText: string,
  centerText: string,
  rightText: string,
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(HEADER_FONT_SIZE);
  doc.setFont('helvetica', 'normal');

  // Left
  doc.text(leftText, 14, HEADER_Y);
  // Center
  doc.text(centerText, pageWidth / 2, HEADER_Y, { align: 'center' });
  // Right
  doc.text(rightText, pageWidth - 14, HEADER_Y, { align: 'right' });
}

/** Render page footer: "Page N" center, "Printed: ..." right */
export function renderPageFooter(
  doc: jsPDF,
  pageNumber: number,
  printedTimestamp: string,
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - FOOTER_MARGIN_BOTTOM;
  doc.setFontSize(FOOTER_FONT_SIZE);
  doc.setFont('helvetica', 'normal');

  doc.text(`Page ${pageNumber}`, pageWidth / 2, y, { align: 'center' });
  doc.text(`Printed: ${printedTimestamp}`, pageWidth - 14, y, { align: 'right' });
}

/** Get the current timestamp as "YYYY/MM/DD HH:MM" */
export function getPrintTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${y}/${mo}/${d} ${h}:${mi}`;
}

/** Standard table styles matching the example PDFs */
export function getBaseTableOptions(doc: jsPDF): Partial<UserOptions> {
  const timestamp = getPrintTimestamp();
  let pageCount = 0;

  return {
    startY: 16,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'left',
    },
    margin: { top: 16, bottom: 14 },
    didDrawPage: () => {
      pageCount++;
      renderPageFooter(doc, pageCount, timestamp);
    },
  };
}

/** Convert jsPDF document to Uint8Array for Tauri file write */
export function pdfToBytes(doc: jsPDF): Uint8Array {
  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

/** Format fractional hours to HH:MM:SS */
export function formatHoursToHMS(hours: number): string {
  if (!isFinite(hours) || hours < 0) return '00:00:00';
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
