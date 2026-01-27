import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { parseCsvToRows } from '../../engine/csvTransformer';
import { useProjectStore } from '../../state/projectStore';

interface ImportCsvDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportCsvDialog({ open: isOpen, onClose }: ImportCsvDialogProps) {
  const [filePath, setFilePath] = useState('');
  const [preview, setPreview] = useState('');
  const [rowCount, setRowCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const importRows = useProjectStore(s => s.importRows);
  const project = useProjectStore(s => s.project);

  if (!isOpen) return null;

  const handleBrowse = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      });
      if (selected) {
        const path = typeof selected === 'string' ? selected : selected;
        setFilePath(path);
        setError('');
        setLoading(true);

        try {
          const content = await readTextFile(path);
          const rows = parseCsvToRows(content);
          setRowCount(rows.length);
          // Show first 5 rows as preview
          const previewLines = content.split('\n').slice(0, 6).join('\n');
          setPreview(previewLines);
        } catch (err) {
          setError(`Failed to parse CSV: ${err}`);
          setRowCount(0);
          setPreview('');
        }
        setLoading(false);
      }
    } catch (err) {
      setError(`Failed to open file: ${err}`);
    }
  };

  const handleImport = async () => {
    if (!filePath) return;
    try {
      const content = await readTextFile(filePath);
      const rows = parseCsvToRows(content);
      importRows(rows);
      onClose();
    } catch (err) {
      setError(`Import failed: ${err}`);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ minWidth: '550px' }}>
        <h2>Import CSV</h2>

        {!project && (
          <div style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>
            Please create or open a project first.
          </div>
        )}

        <div className="form-group">
          <label>CSV File</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={filePath}
              readOnly
              placeholder="Select a CSV file..."
              style={{ flex: 1 }}
            />
            <button onClick={handleBrowse} disabled={!project}>Browse</button>
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--color-danger)', marginBottom: '12px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {rowCount > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', color: 'var(--color-success)', fontWeight: 600, marginBottom: '8px' }}>
              Found {rowCount} rows
            </div>
            <pre style={{
              background: 'var(--color-bg-secondary)',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '200px',
              border: '1px solid var(--color-border)',
            }}>
              {preview}
            </pre>
          </div>
        )}

        {loading && (
          <div style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            Parsing file...
          </div>
        )}

        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={handleImport}
            disabled={!filePath || rowCount === 0 || !project}
          >
            Import {rowCount > 0 ? `${rowCount} Rows` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
