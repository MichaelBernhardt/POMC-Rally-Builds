import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import * as XLSX from 'xlsx';
import { useProjectStore } from '../../state/projectStore';
import {
  categorizeSheets,
  getSheetInfoList,
  parseRouteSheet,
  parseSpeedSheets,
  parseTimeAddSheet,
  SheetCategory,
  SheetInfo,
} from '../../engine/magnumImporter';

interface ImportMagnumDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: (message: string) => void;
}

type Step = 'idle' | 'loading' | 'preview' | 'importing';

export default function ImportMagnumDialog({ open: isOpen, onClose, onComplete }: ImportMagnumDialogProps) {
  const addEmptyNode = useProjectStore(s => s.addEmptyNode);
  const importRows = useProjectStore(s => s.importRows);
  const updateSpeedLookupTable = useProjectStore(s => s.updateSpeedLookupTable);
  const updateTimeAddLookupTable = useProjectStore(s => s.updateTimeAddLookupTable);

  const [step, setStep] = useState<Step>('idle');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [categories, setCategories] = useState<SheetCategory | null>(null);
  const [sheetInfos, setSheetInfos] = useState<SheetInfo[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [importSpeedTables, setImportSpeedTables] = useState(true);
  const [importTimeAdd, setImportTimeAdd] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setStep('idle');
    setWorkbook(null);
    setCategories(null);
    setSheetInfos([]);
    setSelectedSheets(new Set());
    setImportSpeedTables(true);
    setImportTimeAdd(true);
    setError(null);
    setFileName('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePickFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      });
      if (!selected) return;

      const path = typeof selected === 'string' ? selected : selected;
      setFileName(path.split('/').pop() ?? path);
      setStep('loading');
      setError(null);

      const data = await readFile(path);
      const wb = XLSX.read(data, { type: 'array' });

      const cats = categorizeSheets(wb.SheetNames);
      const infos = getSheetInfoList(wb, cats);

      // Pre-select all main route sheets
      const preSelected = new Set<string>(cats.routeSheets);

      setWorkbook(wb);
      setCategories(cats);
      setSheetInfos(infos);
      setSelectedSheets(preSelected);
      setImportSpeedTables(cats.speedSheets.length > 0);
      setImportTimeAdd(cats.timeAddSheet != null);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('idle');
    }
  };

  const toggleSheet = (name: string) => {
    setSelectedSheets(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleImport = async () => {
    if (!workbook || !categories) return;
    setStep('importing');

    const allWarnings: string[] = [];
    let totalRows = 0;
    let nodeCount = 0;

    try {
      // Import selected route/alternate sheets as nodes
      const sheetsToImport = sheetInfos
        .filter(s => selectedSheets.has(s.name) && (s.category === 'route' || s.category === 'alternate'));

      for (const info of sheetsToImport) {
        const ws = workbook.Sheets[info.name];
        if (!ws) continue;

        const result = parseRouteSheet(ws, info.name);
        allWarnings.push(...result.warnings);

        if (result.rows.length > 0) {
          // Create a new node with the sheet name and populate it
          addEmptyNode(info.name);
          importRows(result.rows);
          totalRows += result.rows.length;
          nodeCount++;
        }
      }

      // Import speed tables
      if (importSpeedTables && categories.speedSheets.length > 0) {
        const speedResult = parseSpeedSheets(workbook, categories.speedSheets);
        allWarnings.push(...speedResult.warnings);
        if (speedResult.entries.length > 0) {
          updateSpeedLookupTable(speedResult.entries);
        }
      }

      // Import time-add table
      if (importTimeAdd && categories.timeAddSheet) {
        const taWs = workbook.Sheets[categories.timeAddSheet];
        if (taWs) {
          const taResult = parseTimeAddSheet(taWs);
          allWarnings.push(...taResult.warnings);
          if (taResult.entries.length > 0) {
            updateTimeAddLookupTable(taResult.entries);
          }
        }
      }

      // Build result message
      let msg = `Imported ${nodeCount} sheet${nodeCount !== 1 ? 's' : ''} (${totalRows} rows)`;
      if (importSpeedTables && categories.speedSheets.length > 0) {
        msg += `, ${categories.speedSheets.length} speed tables`;
      }
      if (importTimeAdd && categories.timeAddSheet) {
        msg += ', time-add table';
      }
      if (allWarnings.length > 0) {
        msg += ` — ${allWarnings.length} warning${allWarnings.length !== 1 ? 's' : ''}`;
      }

      handleClose();
      onComplete(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('preview');
    }
  };

  if (!isOpen) return null;

  const routeInfos = sheetInfos.filter(s => s.category === 'route');
  const altInfos = sheetInfos.filter(s => s.category === 'alternate');

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ minWidth: 460, maxWidth: 560 }}>
        <h2>Import Magnum Rally</h2>

        {error && (
          <div style={{ color: 'var(--color-danger, #dc2626)', marginBottom: 12, fontSize: 14 }}>
            {error}
          </div>
        )}

        {step === 'idle' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ marginBottom: 16, color: 'var(--color-text-secondary)' }}>
              Select a Magnum Rally Excel spreadsheet (.xlsx) to import route data, speed tables, and survey history.
            </p>
            <button className="primary" onClick={handlePickFile}>
              Select Excel File
            </button>
          </div>
        )}

        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-secondary)' }}>
            Reading {fileName}...
          </div>
        )}

        {step === 'preview' && categories && (
          <>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              {fileName}
            </p>

            {routeInfos.length > 0 && (
              <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 4px' }}>Route Sheets</legend>
                {routeInfos.map(info => (
                  <label key={info.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedSheets.has(info.name)}
                      onChange={() => toggleSheet(info.name)}
                    />
                    <span>{info.name}</span>
                    <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'auto', fontSize: 12 }}>
                      {info.rowCount} rows
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {altInfos.length > 0 && (
              <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
                <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 4px' }}>Alternate Routes</legend>
                {altInfos.map(info => (
                  <label key={info.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedSheets.has(info.name)}
                      onChange={() => toggleSheet(info.name)}
                    />
                    <span style={{ fontSize: 13 }}>{info.name}</span>
                    <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'auto', fontSize: 12 }}>
                      {info.rowCount} rows
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {(categories.speedSheets.length > 0 || categories.timeAddSheet) && (
              <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
                <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 4px' }}>Lookup Tables</legend>
                {categories.speedSheets.length > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={importSpeedTables}
                      onChange={() => setImportSpeedTables(v => !v)}
                    />
                    <span>Speed tables ({categories.speedSheets.join(', ')})</span>
                  </label>
                )}
                {categories.timeAddSheet && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={importTimeAdd}
                      onChange={() => setImportTimeAdd(v => !v)}
                    />
                    <span>Time-add table</span>
                  </label>
                )}
              </fieldset>
            )}

            <div className="dialog-actions">
              <button onClick={handleClose}>Cancel</button>
              <button
                className="primary"
                onClick={handleImport}
                disabled={selectedSheets.size === 0 && !importSpeedTables && !importTimeAdd}
              >
                Import {selectedSheets.size > 0 ? `${selectedSheets.size} sheet${selectedSheets.size !== 1 ? 's' : ''}` : ''}
              </button>
            </div>
          </>
        )}

        {step === 'importing' && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-secondary)' }}>
            Importing data...
          </div>
        )}
      </div>
    </div>
  );
}
