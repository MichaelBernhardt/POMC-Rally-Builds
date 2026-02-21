import { useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useProjectStore } from '../../state/projectStore';
import { exportCleanCsv, exportOrganiserCsv, exportSpeedAbcdCsv } from '../../engine/csvTransformer';
import { computeCumulativeForGroup } from '../../engine/timeCalculator';

type ExportFormat = 'clean' | 'organiser' | 'speedabcd';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportDialog({ open: isOpen, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('clean');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [exportCount, setExportCount] = useState(0);

  const getDayRows = useProjectStore(s => s.getDayRows);

  if (!isOpen) return null;

  const generateCsv = (): string => {
    const rows = getDayRows();
    const exportable = rows.filter(r => r.type !== null);
    setExportCount(exportable.length);

    switch (format) {
      case 'clean':
        return exportCleanCsv(rows);
      case 'organiser':
        return exportOrganiserCsv(rows);
      case 'speedabcd': {
        const timesA = computeCumulativeForGroup(rows, 'a');
        const timesB = computeCumulativeForGroup(rows, 'b');
        const timesC = computeCumulativeForGroup(rows, 'c');
        const timesD = computeCumulativeForGroup(rows, 'd');
        return exportSpeedAbcdCsv(rows, timesA, timesB, timesC, timesD);
      }
    }
  };

  const handlePreview = () => {
    try {
      const csv = generateCsv();
      // Show first 10 lines
      setPreview(csv.split('\n').slice(0, 11).join('\n'));
      setError('');
    } catch (err) {
      setError(`Preview error: ${err}`);
    }
  };

  const handleExport = async () => {
    try {
      const csv = generateCsv();
      const defaultName = format === 'clean' ? 'RS_Data.csv'
        : format === 'organiser' ? 'RS_Data_Organiser.csv'
        : 'SpeedABCD.csv';

      const savePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      });

      if (savePath) {
        await writeTextFile(savePath, csv);
        onClose();
      }
    } catch (err) {
      setError(`Export error: ${err}`);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ minWidth: '550px' }}>
        <h2>Export CSV</h2>

        <div className="form-group">
          <label>Export Format</label>
          <select value={format} onChange={e => { setFormat(e.target.value as ExportFormat); setPreview(''); }}>
            <option value="clean">Clean (Scoring Program Input)</option>
            <option value="organiser">Organiser (With Annotations)</option>
            <option value="speedabcd">SpeedABCD (Time Verification)</option>
          </select>
        </div>

        <div style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          {format === 'clean' && 'Sequential numbering (1,2,3...), annotations stripped. Ready for import into the scoring program.'}
          {format === 'organiser' && 'Sequential numbering (1,2,3...), {curly brace} annotations preserved. For organisers to use on the day.'}
          {format === 'speedabcd' && 'Distance, speeds, and cumulative times for each speed group. For time calculation verification.'}
        </div>

        <button onClick={handlePreview} style={{ marginBottom: '12px' }}>
          Preview Export
        </button>

        {error && (
          <div style={{ color: 'var(--color-danger)', marginBottom: '12px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {preview && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
              Preview ({exportCount} rows will be exported):
            </div>
            <pre style={{
              background: 'var(--color-bg-secondary)',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '250px',
              border: '1px solid var(--color-border)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {preview}
            </pre>
          </div>
        )}

        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleExport}>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
