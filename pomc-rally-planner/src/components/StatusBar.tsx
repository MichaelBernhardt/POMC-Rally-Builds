import { useProjectStore } from '../state/projectStore';

export default function StatusBar() {
  const project = useProjectStore(s => s.project);
  const currentDayId = useProjectStore(s => s.currentDayId);
  const isDirty = useProjectStore(s => s.isDirty);
  const lastSaved = useProjectStore(s => s.lastSaved);

  const day = project?.days.find(d => d.id === currentDayId);
  const rows = day?.rows ?? [];
  const exportableRows = rows.filter(r => r.type !== null);
  const maxDist = rows.length > 0 ? rows[rows.length - 1]?.rallyDistance ?? 0 : 0;

  return (
    <div style={{
      height: 'var(--statusbar-height)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '24px',
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-bg-secondary)',
      fontSize: '14px',
      color: 'var(--color-text-secondary)',
    }}>
      <span>
        Rows: {rows.length} ({exportableRows.length} exportable)
      </span>
      <span>
        Dist: {maxDist.toFixed(2)} km
      </span>
      <div style={{ flex: 1 }} />
      <span>
        {isDirty ? (
          <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Unsaved changes</span>
        ) : lastSaved ? (
          <span>Saved {lastSaved}</span>
        ) : (
          <span>Not saved</span>
        )}
      </span>
    </div>
  );
}
