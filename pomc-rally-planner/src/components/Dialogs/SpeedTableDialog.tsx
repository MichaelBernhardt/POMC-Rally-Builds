import { useState, useEffect } from 'react';
import { useProjectStore, selectCurrentRally } from '../../state/projectStore';
import { SpeedLookupEntry, TimeAddLookupEntry, TypeCode, TYPE_CODE_LABELS } from '../../types/domain';
import { getDefaultSpeedLookupTable, getDefaultTimeAddLookupTable } from '../../engine/speedCalculator';

export default function SpeedTablePage() {
  const rally = useProjectStore(selectCurrentRally);
  const updateSpeedLookupTable = useProjectStore(s => s.updateSpeedLookupTable);
  const updateTimeAddLookupTable = useProjectStore(s => s.updateTimeAddLookupTable);

  const [entries, setEntries] = useState<SpeedLookupEntry[]>([]);
  const [filterType, setFilterType] = useState<TypeCode | ''>('');
  const [hasChanges, setHasChanges] = useState(false);

  const [timeAddEntries, setTimeAddEntries] = useState<TimeAddLookupEntry[]>([]);
  const [hasTimeAddChanges, setHasTimeAddChanges] = useState(false);

  useEffect(() => {
    if (rally) {
      setEntries([...rally.speedLookupTable]);
      setHasChanges(false);
      setTimeAddEntries([...(rally.timeAddLookupTable ?? [])]);
      setHasTimeAddChanges(false);
    }
  }, [rally?.id]);

  if (!rally) return null;

  const filteredEntries = filterType
    ? entries.filter(e => e.type === filterType)
    : entries;

  const handleUpdate = (index: number, field: keyof SpeedLookupEntry, value: string | number) => {
    const newEntries = [...entries];
    const realIndex = entries.indexOf(filteredEntries[index]);
    if (realIndex === -1) return;
    newEntries[realIndex] = { ...newEntries[realIndex], [field]: typeof value === 'string' ? value : Number(value) };
    setEntries(newEntries);
    setHasChanges(true);
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
    setHasChanges(true);
  };

  const handleDelete = (index: number) => {
    const realIndex = entries.indexOf(filteredEntries[index]);
    if (realIndex === -1) return;
    setEntries(entries.filter((_, i) => i !== realIndex));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSpeedLookupTable(entries);
    setHasChanges(false);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all speed tables to DJ Rally defaults?')) {
      setEntries(getDefaultSpeedLookupTable());
      setHasChanges(true);
    }
  };

  // --- Time Add table handlers ---

  const handleTimeAddUpdate = (index: number, field: keyof TimeAddLookupEntry, value: number) => {
    const newEntries = [...timeAddEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setTimeAddEntries(newEntries);
    setHasTimeAddChanges(true);
  };

  const handleTimeAddAdd = () => {
    setTimeAddEntries([...timeAddEntries, { addTimeA: 0, addTimeB: 0, addTimeC: 0, addTimeD: 0 }]);
    setHasTimeAddChanges(true);
  };

  const handleTimeAddDelete = (index: number) => {
    setTimeAddEntries(timeAddEntries.filter((_, i) => i !== index));
    setHasTimeAddChanges(true);
  };

  const handleTimeAddSave = () => {
    updateTimeAddLookupTable(timeAddEntries);
    setHasTimeAddChanges(false);
  };

  const handleTimeAddResetDefaults = () => {
    if (window.confirm('Reset time-add table to DJ Rally defaults?')) {
      setTimeAddEntries(getDefaultTimeAddLookupTable());
      setHasTimeAddChanges(true);
    }
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Speed Table Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            Speed Tables <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>for {rally.name}</span>
          </h2>
          <div style={{ marginTop: '6px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Maps (type, A-speed) to graduated B/C/D speeds for regularity sections.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasChanges && (
            <span style={{ fontSize: '13px', color: 'var(--color-warning)', fontWeight: 600 }}>Unsaved changes</span>
          )}
          <button className="primary" onClick={handleSave} disabled={!hasChanges}>
            Save Changes
          </button>
        </div>
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
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {filteredEntries.length} entries shown. {entries.length} total.
        </span>
        <button onClick={handleResetDefaults} disabled={false} style={{ fontSize: '13px' }}>
          Reset Defaults
        </button>
        <button onClick={handleAddEntry} disabled={false} style={{ fontSize: '13px' }}>
          + Add Entry
        </button>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        minHeight: 0,
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
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                  <input type="number" value={entry.aSpeed}
                    onChange={e => handleUpdate(i, 'aSpeed', parseInt(e.target.value) || 0)}

                    style={{ width: '70px', minHeight: '30px', textAlign: 'right' }} />
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                  <input type="number" value={entry.bSpeed}
                    onChange={e => handleUpdate(i, 'bSpeed', parseInt(e.target.value) || 0)}

                    style={{ width: '70px', minHeight: '30px', textAlign: 'right' }} />
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                  <input type="number" value={entry.cSpeed}
                    onChange={e => handleUpdate(i, 'cSpeed', parseInt(e.target.value) || 0)}

                    style={{ width: '70px', minHeight: '30px', textAlign: 'right' }} />
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
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

      {/* Time Add Table Section */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            Time Add Table
          </h2>
          <div style={{ marginTop: '6px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Maps A-group break time to B/C/D break times for time-add rows (type t). Used during Recalc Times.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasTimeAddChanges && (
            <span style={{ fontSize: '13px', color: 'var(--color-warning)', fontWeight: 600 }}>Unsaved changes</span>
          )}
          <button className="primary" onClick={handleTimeAddSave} disabled={!hasTimeAddChanges}>
            Save Changes
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {timeAddEntries.length} entries
        </span>
        <button onClick={handleTimeAddResetDefaults} style={{ fontSize: '13px' }}>
          Reset Defaults
        </button>
        <button onClick={handleTimeAddAdd} style={{ fontSize: '13px' }}>
          + Add Entry
        </button>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        minHeight: 0,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-secondary)', position: 'sticky', top: 0 }}>
              <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>A Time</th>
              <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>B Time</th>
              <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>C Time</th>
              <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--color-border)' }}>D Time</th>
              <th style={{ padding: '8px', width: '40px', borderBottom: '1px solid var(--color-border)' }}></th>
            </tr>
          </thead>
          <tbody>
            {timeAddEntries.map((entry, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                  <input type="number" value={entry.addTimeA}
                    onChange={e => handleTimeAddUpdate(i, 'addTimeA', parseInt(e.target.value) || 0)}
                    style={{ width: '70px', minHeight: '30px', textAlign: 'right' }} />
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                  <input type="number" value={entry.addTimeB}
                    onChange={e => handleTimeAddUpdate(i, 'addTimeB', parseInt(e.target.value) || 0)}
                    style={{ width: '70px', minHeight: '30px', textAlign: 'right' }} />
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                  <input type="number" value={entry.addTimeC}
                    onChange={e => handleTimeAddUpdate(i, 'addTimeC', parseInt(e.target.value) || 0)}
                    style={{ width: '70px', minHeight: '30px', textAlign: 'right' }} />
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                  <input type="number" value={entry.addTimeD}
                    onChange={e => handleTimeAddUpdate(i, 'addTimeD', parseInt(e.target.value) || 0)}
                    style={{ width: '70px', minHeight: '30px', textAlign: 'right' }} />
                </td>
                <td style={{ padding: '4px' }}>
                  <button onClick={() => handleTimeAddDelete(i)}
                    style={{ minHeight: '28px', padding: '2px 8px', fontSize: '12px', color: 'var(--color-danger)' }}>
                    X
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
