import { useProjectStore } from '../../state/projectStore';

export default function ProjectTree() {
  const project = useProjectStore(s => s.project);
  const currentDayId = useProjectStore(s => s.currentDayId);
  const selectDay = useProjectStore(s => s.selectDay);
  const addDay = useProjectStore(s => s.addDay);
  const removeDay = useProjectStore(s => s.removeDay);

  if (!project) {
    return (
      <div style={{ padding: '16px', color: 'var(--color-text-muted)' }}>
        No project open
      </div>
    );
  }

  return (
    <div style={{ padding: '8px' }}>
      <div style={{
        fontWeight: 700,
        fontSize: '16px',
        padding: '8px',
        marginBottom: '8px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {project.name}
      </div>

      {project.days.map(day => (
        <div
          key={day.id}
          onClick={() => selectDay(day.id)}
          style={{
            padding: '10px 12px',
            cursor: 'pointer',
            borderRadius: '6px',
            marginBottom: '4px',
            background: day.id === currentDayId ? 'var(--color-primary-light)' : 'transparent',
            fontWeight: day.id === currentDayId ? 600 : 400,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{day.name}</span>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {day.rows.length} rows
          </span>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={() => addDay(`Day ${project.days.length + 1}`)}
          style={{ flex: 1, fontSize: '14px' }}
        >
          + Add Day
        </button>
        {project.days.length > 1 && currentDayId && (
          <button
            onClick={() => {
              if (confirm('Remove this day and all its rows?')) {
                removeDay(currentDayId);
              }
            }}
            className="danger"
            style={{ fontSize: '14px', padding: '8px 12px' }}
          >
            −
          </button>
        )}
      </div>
    </div>
  );
}
