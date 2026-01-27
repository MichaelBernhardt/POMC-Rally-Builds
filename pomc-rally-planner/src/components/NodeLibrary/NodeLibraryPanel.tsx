import { useProjectStore } from '../../state/projectStore';

export default function NodeLibraryPanel() {
  const getCurrentRally = useProjectStore(s => s.getCurrentRally);
  const addNodeTemplate = useProjectStore(s => s.addNodeTemplate);
  const removeNodeTemplate = useProjectStore(s => s.removeNodeTemplate);
  const setEditingTemplate = useProjectStore(s => s.setEditingTemplate);
  const isLocked = useProjectStore(s => s.isCurrentRallyLocked());

  const rally = getCurrentRally();
  if (!rally) return null;

  const templates = rally.nodeLibrary;

  return (
    <div style={{ padding: '24px', overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Node Library</h2>
        {!isLocked && (
          <button className="primary" onClick={() => addNodeTemplate()}>
            + New Template
          </button>
        )}
      </div>

      <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
        Templates are reusable route segments. Create templates here, then place them into days via the Route Builder.
      </div>

      {templates.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '15px',
          border: '2px dashed var(--color-border)',
          borderRadius: '8px',
        }}>
          No templates yet. Click "+ New Template" to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.map(template => (
            <div
              key={template.id}
              style={{
                padding: '14px 16px',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                background: 'var(--color-bg)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onClick={() => setEditingTemplate(template.id)}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                  {template.name}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  {template.description || 'No description'}
                  {' \u2022 '}
                  {template.rows.length} rows
                  {template.allowedPreviousNodes.length > 0 && (
                    <> {' \u2022 '} {template.allowedPreviousNodes.length} connection rules</>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={e => { e.stopPropagation(); setEditingTemplate(template.id); }}
                  disabled={isLocked}
                >
                  Edit
                </button>
                {!isLocked && (
                  <button
                    onClick={e => { e.stopPropagation(); removeNodeTemplate(template.id); }}
                    style={{ color: 'var(--color-danger)' }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
