import { useState, useEffect } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '../../state/projectStore';
import { SpeedLookupEntry, TypeCode, TYPE_CODE_LABELS } from '../../types/domain';
import { getDefaultSpeedLookupTable } from '../../engine/speedCalculator';

interface SpeedTableDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SpeedTableDialog({ open: isOpen, onClose }: SpeedTableDialogProps) {
  const getCurrentRally = useProjectStore(s => s.getCurrentRally);
  const updateSpeedLookupTable = useProjectStore(s => s.updateSpeedLookupTable);

  const [entries, setEntries] = useState<SpeedLookupEntry[]>([]);
  const [filterType, setFilterType] = useState<TypeCode | ''>('');

  const rally = getCurrentRally();

  useEffect(() => {
    if (rally) {
      setEntries([...rally.speedLookupTable]);
    }
  }, [rally, isOpen]);

  if (!isOpen || !rally) return null;

  const filteredEntries = filterType
    ? entries.filter(e => e.type === filterType)
    : entries;

  const handleUpdate = (index: number, field: keyof SpeedLookupEntry, value: string | number) => {
    const newEntries = [...entries];
    const realIndex = entries.indexOf(filteredEntries[index]);
    if (realIndex === -1) return;
    newEntries[realIndex] = { ...newEntries[realIndex], [field]: typeof value === 'string' ? value : Number(value) };
    setEntries(newEntries);
  };

  const handleAddEntry = () => {
    setEntries([...entries, {
      terrain: filterType || 'f',
      type: (filterType || 'f') as TypeCode,
      aSpeed: 30,
      bSpeed: 34,
      cSpeed: 37,
      dSpeed: 41,
    }]);
  };

  const handleDelete = (index: number) => {
    const realIndex = entries.indexOf(filteredEntries[index]);
    if (realIndex === -1) return;
    setEntries(entries.filter((_, i) => i !== realIndex));
  };

  const handleSave = () => {
    updateSpeedLookupTable(entries);
    onClose();
  };

  const handleResetDefaults = async () => {
    const confirmed = await ask('Reset all speed tables to DJ Rally defaults?', {
      title: 'Reset Speed Tables',
      kind: 'warning',
    });
    if (confirmed) {
      setEntries(getDefaultSpeedLookupTable());
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ minWidth: '600px', maxWidth: '700px' }}>
        <h2>Speed Lookup Tables</h2>

        <div style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          Maps (type, A-speed) to graduated B/C/D speeds for regularity sections.
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', fontWeight: 600 }}>Filter by type:</label>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as TypeCode | '')}
            style={{ minHeight: '36px' }}
          >
            <option value="">All Types</option>
            {(['f', 'd', 'u', 'l'] as TypeCode[]).map(t => (
              <option key={t} value={t}>{t} - {TYPE_CODE_LABELS[t]}</option>
            ))}
          </select>
          <div style={{ flex: 1 }} />
          <button onClick={handleResetDefaults} style={{ fontSize: '13px' }}>
            Reset Defaults
          </button>
          <button onClick={handleAddEntry} style={{ fontSize: '13px' }}>
            + Add Entry
          </button>
        </div>

        <div style={{
          maxHeight: '350px',
          overflow: 'auto',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-secondary)', position: 'sticky', top: 0 }}>
                <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Type</th>
                <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>A Speed</th>
                <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>B Speed</th>
                <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>C Speed</th>
                <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>D Speed</th>
                <th style={{ padding: '8px', width: '40px', borderBottom: '1px solid var(--color-border)' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '4px 8px' }}>
                    <select
                      value={entry.type}
                      onChange={e => handleUpdate(i, 'type', e.target.value)}
                      style={{ minHeight: '30px', width: '100%' }}
                    >
                      {(['f', 'd', 'u', 'l'] as TypeCode[]).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input type="number" value={entry.aSpeed}
                      onChange={e => handleUpdate(i, 'aSpeed', parseInt(e.target.value) || 0)}
                      style={{ width: '70px', minHeight: '30px', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input type="number" value={entry.bSpeed}
                      onChange={e => handleUpdate(i, 'bSpeed', parseInt(e.target.value) || 0)}
                      style={{ width: '70px', minHeight: '30px', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input type="number" value={entry.cSpeed}
                      onChange={e => handleUpdate(i, 'cSpeed', parseInt(e.target.value) || 0)}
                      style={{ width: '70px', minHeight: '30px', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input type="number" value={entry.dSpeed}
                      onChange={e => handleUpdate(i, 'dSpeed', parseInt(e.target.value) || 0)}
                      style={{ width: '70px', minHeight: '30px', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <button onClick={() => handleDelete(i)}
                      style={{ minHeight: '28px', padding: '2px 8px', fontSize: '12px', color: 'var(--color-danger)' }}>
                      X
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
          {filteredEntries.length} entries shown. {entries.length} total.
        </div>

        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
