import { useState, useRef, useEffect } from 'react';
import { useProjectStore, selectCurrentRally, selectCurrentDay, selectIsCurrentEditionLocked } from '../../state/projectStore';
import { isTemplateComplete, validateTemplate } from '../../engine/validator';
import ConnectionDiagram from './ConnectionDiagram';
import ImportMagnumDialog from '../Dialogs/ImportMagnumDialog';

export default function NodeLibraryPanel() {
  const rally = useProjectStore(selectCurrentRally);
  const addNodeTemplate = useProjectStore(s => s.addNodeTemplate);
  const removeNodeTemplate = useProjectStore(s => s.removeNodeTemplate);
  const updateNodeTemplate = useProjectStore(s => s.updateNodeTemplate);
  const setEditingTemplate = useProjectStore(s => s.setEditingTemplate);

  const currentDay = useProjectStore(selectCurrentDay);
  const isLocked = useProjectStore(selectIsCurrentEditionLocked);

  const [showDialog, setShowDialog] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [showMagnumImport, setShowMagnumImport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  // 'start' = start node, 'follow' = follows another node, '' = not chosen
  const [ruleType, setRuleType] = useState<'start' | 'follow' | ''>('');
  const [followNodeIds, setFollowNodeIds] = useState<string[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  if (!rally) return null;

  const templates = rally.nodeLibrary;

  const canCreate = newName.trim().length > 0 && (ruleType === 'start' || (ruleType === 'follow' && followNodeIds.length > 0));

  const openDialog = () => {
    setNewName('');
    setRuleType(templates.length === 0 ? 'start' : '');
    setFollowNodeIds([]);
    setShowDialog(true);
  };

  const handleCreate = () => {
    if (!canCreate) return;
    addNodeTemplate({
      name: newName.trim(),
      isStartNode: ruleType === 'start',
      allowedPreviousNodes: ruleType === 'follow' ? followNodeIds : [],
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
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
          Node Library {rally && <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>for {rally.name}</span>}
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowMagnumImport(true)}
            disabled={!currentDay || isLocked}
            title={!currentDay ? 'Select a day first' : 'Import data from Magnum Rally Excel spreadsheet'}
          >
            Import Magnum
          </button>
          <button
            onClick={() => setShowConnections(true)}
            disabled={templates.length === 0}
          >
            Route Connections
          </button>
          <button className="primary" onClick={openDialog}>
            + New Node
          </button>
        </div>
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
            // Check if any other template references this one
            const referencedBy = templates.filter(t => t.id !== template.id && t.allowedPreviousNodes.includes(template.id));
            const isReferenced = referencedBy.length > 0;
            const followsNames = template.allowedPreviousNodes.length > 0
              ? template.allowedPreviousNodes.map(id => templates.find(t => t.id === id)?.name ?? '?').join(', ')
              : null;

            return (
              <div
                key={template.id}
                style={{
                  padding: '14px 16px',
                  border: `1px solid ${complete ? 'var(--color-border)' : 'var(--color-warning)'}`,
                  borderRadius: '8px',
                  background: 'var(--color-bg)',
                }}
              >
                {/* Top row: name + badges + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                    <input
                      type="text"
                      value={template.name}
                      onChange={e => updateNodeTemplate(template.id, { name: e.target.value })}
                      style={{
                        fontWeight: 600,
                        fontSize: '15px',
                        border: '1px solid transparent',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        background: 'transparent',
                        flex: 1,
                        minWidth: 0,
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-bg)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                    />
                    {!complete && (
                      <span style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        INCOMPLETE
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '8px' }}>
                    <button onClick={() => setEditingTemplate(template.id)}>
                      Edit Rows
                    </button>
                    <button
                      onClick={() => { if (!isReferenced) removeNodeTemplate(template.id); }}
                      disabled={isReferenced}
                      title={isReferenced ? `Referenced by: ${referencedBy.map(t => t.name).join(', ')}` : 'Delete this node'}
                      style={{
                        color: isReferenced ? 'var(--color-text-muted)' : 'var(--color-danger)',
                        cursor: isReferenced ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '6px' }}>
                  <input
                    type="text"
                    value={template.description}
                    onChange={e => updateNodeTemplate(template.id, { description: e.target.value })}
                    placeholder="Add a description..."
                    style={{
                      fontSize: '13px',
                      color: 'var(--color-text-muted)',
                      border: '1px solid transparent',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      background: 'transparent',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-bg)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                  />
                </div>

                {/* Info row: rows count + connection info */}
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                  <span>{template.rows.length} rows</span>
                  {template.isStartNode && (
                    <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Start node</span>
                  )}
                  {followsNames && (
                    <span>Follows: <strong>{followsNames}</strong></span>
                  )}
                  {isReferenced && (
                    <span>Followed by: <strong>{referencedBy.map(t => t.name).join(', ')}</strong></span>
                  )}
                </div>

                {/* Validation warnings */}
                {!complete && (
                  <div style={{ fontSize: '11px', color: 'var(--color-warning)', marginTop: '4px' }}>
                    {warnings.map(w => w.message).join(' \u2022 ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Route Connections diagram */}
      {showConnections && (
        <ConnectionDiagram templates={templates} onClose={() => setShowConnections(false)} />
      )}

      <ImportMagnumDialog
        open={showMagnumImport}
        onClose={() => setShowMagnumImport(false)}
        onComplete={msg => {
          setToast(msg);
          setTimeout(() => setToast(null), 4000);
        }}
      />

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-text)',
          color: 'var(--color-bg)',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
        }}>
          {toast}
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
                onChange={() => { setRuleType('start'); setFollowNodeIds([]); }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>Start node</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Can be the first node in a day</div>
              </div>
            </label>

            {/* Follows node option */}
            {templates.length > 0 && (
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                border: `1px solid ${ruleType === 'follow' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '8px',
                background: ruleType === 'follow' ? 'var(--color-primary-light, #EEF2FF)' : 'transparent',
              }}>
                <input
                  type="radio"
                  name="connectionRule"
                  checked={ruleType === 'follow'}
                  onChange={() => setRuleType('follow')}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Follows another node</div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    padding: '4px 0',
                  }}>
                    {templates.map(t => (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={followNodeIds.includes(t.id)}
                          onChange={e => {
                            setRuleType('follow');
                            if (e.target.checked) {
                              setFollowNodeIds(prev => [...prev, t.id]);
                            } else {
                              setFollowNodeIds(prev => prev.filter(id => id !== t.id));
                            }
                          }}
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                </div>
              </label>
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
