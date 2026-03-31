import { useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import * as XLSX from 'xlsx';
import { useProjectStore } from '../../state/projectStore';
import { getNodeSheetInfoList, parseNodeSheets, NodeSheetInfo } from '../../engine/nodeImporter';
import { generateNodeImportTemplate } from '../../engine/nodeImportTemplate';

interface ImportNodesDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: (message: string) => void;
}

type Step = 'idle' | 'loading' | 'preview' | 'importing';

export default function ImportNodesDialog({ open: isOpen, onClose, onComplete }: ImportNodesDialogProps) {
  const importMagnumNodes = useProjectStore(s => s.importMagnumNodes);

  const [step, setStep] = useState<Step>('idle');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetInfos, setSheetInfos] = useState<NodeSheetInfo[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setStep('idle');
    setWorkbook(null);
    setSheetInfos([]);
    setSelectedSheets(new Set());
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

      const infos = getNodeSheetInfoList(wb);

      // Pre-select all sheets
      const preSelected = new Set<string>(infos.map(i => i.name));

      setWorkbook(wb);
      setSheetInfos(infos);
      setSelectedSheets(preSelected);
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
    if (!workbook) return;
    setStep('importing');

    try {
      const selected = sheetInfos
        .filter(s => selectedSheets.has(s.name))
        .map(s => s.name);

      const result = parseNodeSheets(workbook, selected);

      if (result.sheets.length > 0) {
        importMagnumNodes(result.sheets);
      }

      let msg = `Imported ${result.sheets.length} node${result.sheets.length !== 1 ? 's' : ''}`;
      const totalRows = result.sheets.reduce((sum, s) => sum + s.rows.length, 0);
      msg += ` (${totalRows} rows)`;
      if (result.warnings.length > 0) {
        msg += ` — ${result.warnings.length} warning${result.warnings.length !== 1 ? 's' : ''}`;
      }

      handleClose();
      onComplete(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('preview');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const path = await save({
        defaultPath: 'Node_Import_Template.xlsx',
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
      });
      if (!path) return;

      const data = generateNodeImportTemplate();
      await writeFile(path, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ minWidth: 460, maxWidth: 560 }}>
        <h2>Import Nodes</h2>

        {error && (
          <div style={{ color: 'var(--color-danger, #dc2626)', marginBottom: 12, fontSize: 14 }}>
            {error}
          </div>
        )}

        {step === 'idle' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ marginBottom: 16, color: 'var(--color-text-secondary)' }}>
              Select an Excel file where each sheet is a node.
              Each sheet needs columns: Rally Dist, Typ, Instruction, A Sp, B Sp, C Sp, D Sp.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="primary" onClick={handlePickFile}>
                Select Excel File
              </button>
              <button onClick={handleDownloadTemplate}>
                Download Template
              </button>
            </div>
          </div>
        )}

        {step === 'loading' && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-secondary)' }}>
            Reading {fileName}...
          </div>
        )}

        {step === 'preview' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              {fileName} — select sheets to import as nodes
            </p>

            {sheetInfos.length > 0 ? (
              <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
                <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 4px' }}>Sheets (each becomes a node)</legend>
                {sheetInfos.map(info => (
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
            ) : (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                No importable sheets found. Make sure each sheet has a header row with "Rally Dist", "Typ", "Instruction".
              </p>
            )}

            <div className="dialog-actions">
              <button onClick={handleDownloadTemplate} style={{ marginRight: 'auto' }}>
                Download Template
              </button>
              <button onClick={handleClose}>Cancel</button>
              <button
                className="primary"
                onClick={handleImport}
                disabled={selectedSheets.size === 0}
              >
                Import {selectedSheets.size > 0 ? `${selectedSheets.size} node${selectedSheets.size !== 1 ? 's' : ''}` : ''}
              </button>
            </div>
          </>
        )}

        {step === 'importing' && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-secondary)' }}>
            Importing nodes...
          </div>
        )}
      </div>
    </div>
  );
}
