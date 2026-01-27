import { useProjectStore } from '../../state/projectStore';

export default function ProjectTree() {
  const workspace = useProjectStore(s => s.workspace);
  const currentRallyId = useProjectStore(s => s.currentRallyId);
  const currentDayId = useProjectStore(s => s.currentDayId);
  const selectRallyDay = useProjectStore(s => s.selectRallyDay);
  const addRally = useProjectStore(s => s.addRally);
  const removeRally = useProjectStore(s => s.removeRally);
  const addDay = useProjectStore(s => s.addDay);
  const removeDay = useProjectStore(s => s.removeDay);
  const selectRally = useProjectStore(s => s.selectRally);
  const updateRallyName = useProjectStore(s => s.updateRallyName);

  if (!workspace || workspace.rallies.length === 0) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{
          fontSize: '11px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-text-muted)',
          marginBottom: '8px',
        }}>
          Rallies
        </div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '12px' }}>
          No rallies yet
        </div>
        <button
          onClick={() => {
            const name = prompt('Rally name:', 'My Rally');
            if (name?.trim()) addRally(name.trim());
          }}
          style={{ fontSize: '14px', width: '100%' }}
        >
          + Add Rally
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px' }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--color-text-muted)',
        padding: '0 4px',
        marginBottom: '8px',
      }}>
        Rallies
      </div>

      {workspace.rallies.map(rally => {
        const isSelectedRally = rally.id === currentRallyId;

        return (
          <div key={rally.id} style={{ marginBottom: '8px' }}>
            {/* Rally header */}
            <div
              onClick={() => selectRally(rally.id)}
              onDoubleClick={() => {
                const name = prompt('Rename rally:', rally.name);
                if (name?.trim()) updateRallyName(rally.id, name.trim());
              }}
              style={{
                padding: '8px 8px',
                cursor: 'pointer',
                borderRadius: '6px',
                background: isSelectedRally ? 'var(--color-primary-light)' : 'transparent',
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--color-text)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {rally.name}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                {rally.days.length} {rally.days.length === 1 ? 'day' : 'days'}
              </span>
            </div>

            {/* Days under this rally */}
            {isSelectedRally && (
              <div style={{ paddingLeft: '12px' }}>
                {rally.days.map(day => (
                  <div
                    key={day.id}
                    onClick={() => selectRallyDay(rally.id, day.id)}
                    style={{
                      padding: '6px 8px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      marginTop: '2px',
                      background: day.id === currentDayId ? 'var(--color-bg-secondary)' : 'transparent',
                      fontWeight: day.id === currentDayId ? 600 : 400,
                      fontSize: '13px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{day.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {day.rows.length} rows
                    </span>
                  </div>
                ))}

                {/* Add/Remove day buttons */}
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  <button
                    onClick={() => addDay(`Day ${rally.days.length + 1}`)}
                    style={{ flex: 1, fontSize: '12px', padding: '4px 8px', minHeight: '28px' }}
                  >
                    + Day
                  </button>
                  {rally.days.length > 1 && currentDayId && (
                    <button
                      onClick={() => {
                        if (confirm('Remove this day and all its rows?')) {
                          removeDay(currentDayId);
                        }
                      }}
                      className="danger"
                      style={{ fontSize: '12px', padding: '4px 8px', minHeight: '28px' }}
                    >
                      - Day
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add/Remove rally buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', padding: '0 4px' }}>
        <button
          onClick={() => {
            const name = prompt('Rally name:', 'My Rally');
            if (name?.trim()) addRally(name.trim());
          }}
          style={{ flex: 1, fontSize: '13px' }}
        >
          + Add Rally
        </button>
        {workspace.rallies.length > 0 && currentRallyId && (
          <button
            onClick={() => {
              if (confirm('Remove this rally and all its days?')) {
                removeRally(currentRallyId);
              }
            }}
            className="danger"
            style={{ fontSize: '13px', padding: '8px 12px' }}
          >
            - Rally
          </button>
        )}
      </div>
    </div>
  );
}
