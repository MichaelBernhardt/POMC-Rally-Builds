import { useProjectStore } from '../../state/projectStore';

export default function DayPanel() {
  const getCurrentRally = useProjectStore(s => s.getCurrentRally);
  const currentDayId = useProjectStore(s => s.currentDayId);
  const updateDaySettings = useProjectStore(s => s.updateDaySettings);
  const recalculateTimes = useProjectStore(s => s.recalculateTimes);

  const rally = getCurrentRally();
  if (!rally || !currentDayId) return null;
  const day = rally.days.find(d => d.id === currentDayId);
  if (!day) return null;

  return (
    <div style={{ padding: '8px', borderTop: '1px solid var(--color-border)', marginTop: '8px' }}>
      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
        Day Settings
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: 'var(--color-text-muted)' }}>
          Day Name
        </label>
        <input
          type="text"
          value={day.name}
          onChange={e => updateDaySettings(currentDayId, { name: e.target.value })}
          style={{ width: '100%', minHeight: '36px' }}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: 'var(--color-text-muted)' }}>
          Start Time (HH:MM:SS)
        </label>
        <input
          type="text"
          value={day.startTime}
          onChange={e => updateDaySettings(currentDayId, { startTime: e.target.value })}
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
          min={1}
          style={{ width: '100%', minHeight: '36px' }}
        />
      </div>

      <button
        onClick={recalculateTimes}
        className="primary"
        style={{ width: '100%', fontSize: '14px' }}
      >
        Recalculate Times
      </button>
    </div>
  );
}
