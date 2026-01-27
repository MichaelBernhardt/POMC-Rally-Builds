import { useProjectStore } from '../../state/projectStore';

export default function NodePalette() {
  const getCurrentRally = useProjectStore(s => s.getCurrentRally);
  const placeNode = useProjectStore(s => s.placeNode);
  const addEmptyNode = useProjectStore(s => s.addEmptyNode);
  const setViewMode = useProjectStore(s => s.setViewMode);

  const rally = getCurrentRally();
  if (!rally) return null;

  const templates = rally.nodeLibrary;

  return (
    <div style={{ padding: '12px' }}>
      <div style={{
        fontWeight: 600,
        fontSize: '13px',
        marginBottom: '12px',
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Node Palette
      </div>

      <button
        onClick={() => addEmptyNode()}
        style={{ width: '100%', marginBottom: '8px', fontSize: '13px' }}
      >
        + Empty Node
      </button>

      {templates.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '8px 0' }}>
          No templates in library.{' '}
          <span
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => setViewMode('library')}
          >
            Create one
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {templates.map(template => (
            <div
              key={template.id}
              onClick={() => placeNode(template.id)}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                background: 'var(--color-bg)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            >
              <div style={{ fontWeight: 600 }}>{template.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {template.rows.length} rows
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
