import { useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { useProjectStore, selectCurrentRally, selectCurrentDay } from '../../state/projectStore';
import { flattenDayRows } from '../../state/storeHelpers';
import { resolveSpeedGroupSettings } from '../../types/domain';
import { generateMasterSchedulePdf } from '../../engine/reports/masterSchedulePdf';
import { generateCompetitorSchedulePdf } from '../../engine/reports/competitorSchedulePdf';
import { generateCheckSchedulePdf } from '../../engine/reports/checkSchedulePdf';
import { generateCpCsv } from '../../engine/reports/cpCsvExporter';

type ReportType = 'master' | 'competitor' | 'check' | 'cp';
type SpeedGroup = 'a' | 'b' | 'c' | 'd';

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ReportDialog({ open: isOpen, onClose }: ReportDialogProps) {
  const [reportType, setReportType] = useState<ReportType>('master');
  const [selectedGroups, setSelectedGroups] = useState<Set<SpeedGroup>>(new Set(['a', 'b', 'c']));
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const rally = useProjectStore(selectCurrentRally);
  const day = useProjectStore(selectCurrentDay);
  const getDayRows = useProjectStore(s => s.getDayRows);

  if (!isOpen) return null;

  const sgs = day ? resolveSpeedGroupSettings(day) : null;

  const toggleGroup = (g: SpeedGroup) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const groupHasCars = (g: SpeedGroup): boolean => {
    if (!sgs) return false;
    return sgs[g].numberOfCars > 0;
  };

  const buildDefaultFilename = (suffix: string, ext: string): string => {
    const datePart = day?.date ?? new Date().toISOString().slice(0, 10);
    const rallyPart = rally?.name?.replace(/\s+/g, '') ?? 'Rally';
    const dayPart = day?.name?.replace(/\s+/g, '') ?? 'Day1';
    return `${datePart}_${rallyPart}_${dayPart}_${suffix}.${ext}`;
  };

  const handleGenerate = async () => {
    if (!rally || !day || !sgs) {
      setError('No rally/day selected');
      return;
    }

    setError('');
    setGenerating(true);

    try {
      const rows = getDayRows();
      if (rows.length === 0) {
        setError('No rows in current day');
        setGenerating(false);
        return;
      }

      const baseOptions = {
        rows,
        dayName: day.name,
        rallyName: rally.name,
        startTime: day.startTime,
        speedGroupSettings: sgs,
      };

      if (reportType === 'master') {
        const pdf = generateMasterSchedulePdf(baseOptions);
        const path = await save({
          defaultPath: buildDefaultFilename('MasterRouteSchedule', 'pdf'),
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        });
        if (path) {
          await writeFile(path, pdf);
          onClose();
        }
      } else if (reportType === 'check') {
        const pdf = generateCheckSchedulePdf(baseOptions);
        const path = await save({
          defaultPath: buildDefaultFilename('CheckRouteSchedule', 'pdf'),
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        });
        if (path) {
          await writeFile(path, pdf);
          onClose();
        }
      } else if (reportType === 'cp') {
        const csv = generateCpCsv(baseOptions);
        const path = await save({
          defaultPath: buildDefaultFilename('CP', 'csv'),
          filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        });
        if (path) {
          await writeTextFile(path, csv);
          onClose();
        }
      } else if (reportType === 'competitor') {
        const groups = Array.from(selectedGroups).sort();
        if (groups.length === 0) {
          setError('Select at least one speed group');
          setGenerating(false);
          return;
        }
        for (const group of groups) {
          const pdf = generateCompetitorSchedulePdf({
            ...baseOptions,
            group,
            dayDate: day.date,
          });
          const groupLabel = group.toUpperCase();
          const headlineSpeed = getHeadlineSpeedForGroup(rows, group);
          const suffix = `${groupLabel}_Speed(${headlineSpeed})RouteSchedule`;
          const path = await save({
            defaultPath: buildDefaultFilename(suffix, 'pdf'),
            filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
          });
          if (path) {
            await writeFile(path, pdf);
          } else {
            // User cancelled — stop generating remaining groups
            break;
          }
        }
        onClose();
      }
    } catch (err) {
      setError(`Generation error: ${err}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ minWidth: '450px' }}>
        <h2>Generate Reports</h2>

        <div className="form-group">
          <label>Report Type</label>
          <select
            value={reportType}
            onChange={e => { setReportType(e.target.value as ReportType); setError(''); }}
          >
            <option value="master">Master Route Schedule (PDF)</option>
            <option value="competitor">Competitor Route Schedules (PDF)</option>
            <option value="check">Check Route Schedule (PDF)</option>
            <option value="cp">Control Points - CP (CSV)</option>
          </select>
        </div>

        <div style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          {reportType === 'master' && 'For marshals & officials. All speed groups, first/last car times. Keeps {annotations}.'}
          {reportType === 'competitor' && 'One PDF per speed group. Zero time, stripped annotations, controls omitted.'}
          {reportType === 'check' && 'For third-party route checking. Like Master but with GPS coordinates for controls.'}
          {reportType === 'cp' && 'Control point CSV with GPS coordinates and absolute times in seconds per speed group.'}
        </div>

        {reportType === 'competitor' && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>Speed Groups</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(['a', 'b', 'c', 'd'] as SpeedGroup[]).map(g => {
                const hasCars = groupHasCars(g);
                return (
                  <label
                    key={g}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      opacity: hasCars ? 1 : 0.5,
                      cursor: hasCars ? 'pointer' : 'default',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(g)}
                      onChange={() => toggleGroup(g)}
                      disabled={!hasCars}
                    />
                    {g.toUpperCase()}
                    {!hasCars && <span style={{ fontSize: '11px' }}>(0 cars)</span>}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {!day?.date && reportType === 'competitor' && (
          <div style={{
            marginBottom: '12px', padding: '8px', borderRadius: '6px',
            background: 'var(--color-warning-bg, #fff3cd)', fontSize: '13px',
            border: '1px solid var(--color-warning-border, #ffc107)',
          }}>
            No date set for this day. Set it in Day Settings for the report header.
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--color-danger)', marginBottom: '12px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Quick helper to get headline speed for filename */
function getHeadlineSpeedForGroup(rows: import('../../types/domain').RouteRow[], group: SpeedGroup): number {
  const regularityTypes = ['o', 'f', 'd', 'u', 'l'];
  let max = 0;
  for (const row of rows) {
    if (row.type && regularityTypes.includes(row.type)) {
      const speed = group === 'a' ? row.aSpeed : group === 'b' ? row.bSpeed : group === 'c' ? row.cSpeed : row.dSpeed;
      if (speed > max) max = speed;
    }
  }
  return max;
}
