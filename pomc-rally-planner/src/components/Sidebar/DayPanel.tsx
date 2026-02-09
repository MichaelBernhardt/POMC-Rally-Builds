import { useProjectStore, selectCurrentRally, selectCurrentDay, selectIsCurrentEditionLocked } from '../../state/projectStore';
import { flattenDayRows } from '../../state/storeHelpers';

export default function DayPanel() {
  const rally = useProjectStore(selectCurrentRally);
  const day = useProjectStore(selectCurrentDay);
  const currentDayId = useProjectStore(s => s.currentDayId);
  const viewMode = useProjectStore(s => s.viewMode);
  const updateDaySettings = useProjectStore(s => s.updateDaySettings);
  const recalculateTimes = useProjectStore(s => s.recalculateTimes);
  const locked = useProjectStore(selectIsCurrentEditionLocked);
  if (!rally || !currentDayId || !day) return null;
  if (viewMode === 'library') return null;
  const totalRows = flattenDayRows(day).length;

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

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: 'var(--color-text-muted)' }}>
          Car Interval (seconds)
        </label>
        <input
          type="number"
          value={day.carIntervalSeconds}
          onChange={e => updateDaySettings(currentDayId, { carIntervalSeconds: parseInt(e.target.value) || 60 })}
          disabled={locked}
          min={1}
          style={{ width: '100%', minHeight: '36px' }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: 'var(--color-text-muted)' }}>
          Number of Cars
        </label>
        <input
          type="number"
          value={day.numberOfCars}
          onChange={e => updateDaySettings(currentDayId, { numberOfCars: parseInt(e.target.value) || 1 })}
          disabled={locked}
          min={1}
          style={{ width: '100%', minHeight: '36px' }}
        />
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
