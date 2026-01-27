import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { isTemplateComplete, validateTemplate } from '../../engine/validator';

export default function NodeLibraryPanel() {
  const getCurrentRally = useProjectStore(s => s.getCurrentRally);
  const addNodeTemplate = useProjectStore(s => s.addNodeTemplate);
  const removeNodeTemplate = useProjectStore(s => s.removeNodeTemplate);
  const setEditingTemplate = useProjectStore(s => s.setEditingTemplate);
  const isLocked = useProjectStore(s => s.isCurrentRallyLocked());

  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState('');
  // 'start' = start node, 'follow' = follows another node, '' = not chosen
  const [ruleType, setRuleType] = useState<'start' | 'follow' | ''>('');
  const [followNodeId, setFollowNodeId] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const rally = getCurrentRally();
  if (!rally) return null;

  const templates = rally.nodeLibrary;

  const canCreate = newName.trim().length > 0 && (ruleType === 'start' || (ruleType === 'follow' && followNodeId !== ''));

  const openDialog = () => {
    setNewName('');
    setRuleType(templates.length === 0 ? 'start' : '');
    setFollowNodeId('');
    setShowDialog(true);
  };

  const handleCreate = () => {
    if (!canCreate) return;
    addNodeTemplate({
      name: newName.trim(),
      isStartNode: ruleType === 'start',
      allowedPreviousNodes: ruleType === 'follow' && followNodeId ? [followNodeId] : [],
    });
    setShowDialog(false);
  };

  // Focus name input when dialog opens
  useEffect(() => {
    if (showDialog && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [showDialog]);

  // Close dialog on Escape or outside click
  useEffect(() => {
    if (!showDialog) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDialog(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setShowDialog(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [showDialog]);

  return (
    <div style={{ padding: '24px', overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Node Library</h2>
        {!isLocked && (
          <button className="primary" onClick={openDialog}>
            + New Node
          </button>
        )}
      </div>

      <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
        Create nodes here, then place them into days via the Route Builder.
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
          No nodes yet. Click "+ New Node" to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.map(template => {
            const complete = isTemplateComplete(template);
            const warnings = validateTemplate(template);

            return (
              <div
                key={template.id}
                style={{
                  padding: '14px 16px',
                  border: `1px solid ${complete ? 'var(--color-border)' : 'var(--color-warning)'}`,
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
                  <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {template.name}
                    {!complete && (
                      <span style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 600 }}>
                        INCOMPLETE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    {template.description || 'No description'}
                    {' \u2022 '}
                    {template.rows.length} rows
                    {template.isStartNode && (
                      <> {' \u2022 '} <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Start</span></>
                    )}
                    {template.allowedPreviousNodes.length > 0 && (() => {
                      const prevName = templates.find(t => t.id === template.allowedPreviousNodes[0])?.name ?? '?';
                      return <> {' \u2022 '} Follows: {prevName}</>;
                    })()}
                  </div>
                  {!complete && (
                    <div style={{ fontSize: '11px', color: 'var(--color-warning)', marginTop: '4px' }}>
                      {warnings.map(w => w.message).join(' \u2022 ')}
                    </div>
                  )}
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
            );
          })}
        </div>
      )}

      {/* New Node dialog */}
      {showDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}>
          <div
            ref={dialogRef}
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '24px',
              width: '420px',
              maxWidth: '90vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 700 }}>
              New Node
            </h3>

            {/* Name */}
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Node name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Stage Start, Transit, Service Park..."
              onKeyDown={e => { if (e.key === 'Enter' && canCreate) handleCreate(); }}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '14px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                marginBottom: '16px',
                boxSizing: 'border-box',
              }}
            />

            {/* Connection rule */}
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Connection rule <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(pick one)</span>
            </label>

            {/* Start node option */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              border: `1px solid ${ruleType === 'start' ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              marginBottom: '8px',
              background: ruleType === 'start' ? 'var(--color-primary-light, #EEF2FF)' : 'transparent',
            }}>
              <input
                type="radio"
                name="connectionRule"
                checked={ruleType === 'start'}
                onChange={() => { setRuleType('start'); setFollowNodeId(''); }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>Start node</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Can be the first node in a day</div>
              </div>
            </label>

            {/* Follows node option */}
            {templates.length > 0 && (
              <div style={{
                border: `1px solid ${ruleType === 'follow' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: '6px',
                padding: '8px 10px',
                marginBottom: '8px',
                background: ruleType === 'follow' ? 'var(--color-primary-light, #EEF2FF)' : 'transparent',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                  <input
                    type="radio"
                    name="connectionRule"
                    checked={ruleType === 'follow'}
                    onChange={() => setRuleType('follow')}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>Follows another node</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Select which node comes before this one</div>
                  </div>
                </label>
                {ruleType === 'follow' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '24px' }}>
                    {templates.map(t => (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="radio"
                          name="followNode"
                          checked={followNodeId === t.id}
                          onChange={() => setFollowNodeId(t.id)}
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!canCreate && newName.trim().length > 0 && ruleType === '' && (
              <div style={{ fontSize: '12px', color: 'var(--color-warning)', marginBottom: '8px' }}>
                Select a connection rule above.
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setShowDialog(false)}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={!canCreate}
                onClick={handleCreate}
              >
                Create Node
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
