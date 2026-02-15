import { useMemo } from 'react';
import { useProjectStore, selectCurrentRally, selectCurrentDay, selectIsCurrentEditionLocked } from '../../state/projectStore';
import { flattenDayRows } from '../../state/storeHelpers';
import { resolveSpeedGroupSettings, SpeedGroupSettings } from '../../types/domain';

const GROUP_KEYS: readonly ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
const GROUP_LABELS = ['A', 'B', 'C', 'D'] as const;
const GAP_KEYS: (keyof SpeedGroupSettings)[] = ['gapABSeconds', 'gapBCSeconds', 'gapCDSeconds'];

/** Compact input overrides — the global CSS sets min-height:44px which is too tall here */
const compactInput: React.CSSProperties = {
  minHeight: '28px',
  height: '28px',
  padding: '2px 4px',
  fontSize: '13px',
  textAlign: 'center',
  width: '100%',
};

export default function DayPanel() {
  const rally = useProjectStore(selectCurrentRally);
  const day = useProjectStore(selectCurrentDay);
  const currentDayId = useProjectStore(s => s.currentDayId);
  const viewMode = useProjectStore(s => s.viewMode);
  const updateDaySettings = useProjectStore(s => s.updateDaySettings);
  const recalculateTimes = useProjectStore(s => s.recalculateTimes);
  const locked = useProjectStore(selectIsCurrentEditionLocked);
  const sgs = useMemo(() => day ? resolveSpeedGroupSettings(day) : null, [day]);
  if (!rally || !currentDayId || !day || !sgs) return null;
  if (viewMode === 'library') return null;
  const totalRows = flattenDayRows(day).length;

  const updateGroup = (group: 'a' | 'b' | 'c' | 'd', field: 'numberOfCars' | 'carIntervalSeconds', value: number) => {
    const updated: SpeedGroupSettings = {
      ...sgs,
      [group]: { ...sgs[group], [field]: value },
    };
    updateDaySettings(currentDayId, { speedGroupSettings: updated });
  };

  const updateGap = (key: keyof SpeedGroupSettings, value: number) => {
    const updated: SpeedGroupSettings = { ...sgs, [key]: value };
    updateDaySettings(currentDayId, { speedGroupSettings: updated });
  };

  return (
    <div style={{ padding: '8px', borderTop: '1px solid var(--color-border)', marginTop: '8px' }}>
      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
        {day.name} Settings
      </div>

      {/* Node summary */}
      <div style={{ marginBottom: '10px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
        {day.nodes.length} {day.nodes.length === 1 ? 'node' : 'nodes'} / {totalRows} total rows
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: 'var(--color-text-muted)' }}>
          Start Time (HH:MM:SS)
        </label>
        <input
          type="text"
          value={day.startTime}
          onChange={e => updateDaySettings(currentDayId, { startTime: e.target.value })}
          disabled={locked}
          placeholder="08:00:00"
          style={{ width: '100%', minHeight: '36px' }}
        />
      </div>

      {/* Per-group car settings — table layout */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: 'var(--color-text-secondary)' }}>
          Speed Groups
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '20px 1fr 1fr 1fr',
          gap: '4px',
          marginBottom: '3px',
          fontSize: '11px',
          color: 'var(--color-text-muted)',
        }}>
          <span />
          <span>Cars</span>
          <span>Interval (s)</span>
          <span>Gap (s)</span>
        </div>

        {GROUP_KEYS.map((g, i) => (
          <div
            key={g}
            style={{
              display: 'grid',
              gridTemplateColumns: '20px 1fr 1fr 1fr',
              gap: '4px',
              marginBottom: '2px',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '13px' }}>{GROUP_LABELS[i]}</span>
            <input
              type="number"
              min={0}
              value={sgs[g].numberOfCars}
              onChange={e => updateGroup(g, 'numberOfCars', parseInt(e.target.value) || 0)}
              disabled={locked}
              style={compactInput}
            />
            <input
              type="number"
              min={1}
              value={sgs[g].carIntervalSeconds}
              onChange={e => updateGroup(g, 'carIntervalSeconds', parseInt(e.target.value) || 60)}
              disabled={locked}
              style={compactInput}
            />
            {i < 3 ? (
              <input
                type="number"
                min={0}
                value={sgs[GAP_KEYS[i]] as number}
                onChange={e => updateGap(GAP_KEYS[i], parseInt(e.target.value) || 0)}
                disabled={locked}
                style={compactInput}
              />
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: 'var(--color-text-muted)' }}>
          Recon Distance Tolerance (km)
        </label>
        <input
          type="number"
          step="0.01"
          min={0}
          value={day.reconDistanceTolerance ?? 0.01}
          onChange={e => {
            const next = parseFloat(e.target.value);
            updateDaySettings(currentDayId, { reconDistanceTolerance: Number.isFinite(next) ? next : 0.01 });
          }}
          disabled={locked}
          style={{ width: '100%', minHeight: '36px' }}
        />
      </div>

      <button
        onClick={recalculateTimes}
        disabled={locked}
        className="primary"
        style={{ width: '100%', fontSize: '14px' }}
      >
        Recalculate Times
      </button>
    </div>
  );
}
