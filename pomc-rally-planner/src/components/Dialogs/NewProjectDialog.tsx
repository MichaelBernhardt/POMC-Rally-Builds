import { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../state/projectStore';

interface NewEditionDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function NewEditionDialog({ open, onClose }: NewEditionDialogProps) {
  const workspace = useProjectStore(s => s.workspace);
  const addRally = useProjectStore(s => s.addRally);
  const selectRally = useProjectStore(s => s.selectRally);
  const addEdition = useProjectStore(s => s.addEdition);

  const rallies = workspace?.rallies ?? [];
  const currentYear = new Date().getFullYear().toString();

  // 'new' = create a new rally, or an existing rally ID
  const [selectedRallyId, setSelectedRallyId] = useState<string>('new');
  const [newRallyName, setNewRallyName] = useState('');
  const [editionName, setEditionName] = useState(currentYear);
  const editionInputRef = useRef<HTMLInputElement>(null);
  const rallyInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedRallyId(rallies.length === 0 ? 'new' : rallies[0].id);
      setNewRallyName('');
      setEditionName(currentYear);
    }
  }, [open]);

  // Focus the right input
  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      if (selectedRallyId === 'new' && rallyInputRef.current) {
        rallyInputRef.current.focus();
      } else if (editionInputRef.current) {
        editionInputRef.current.focus();
        editionInputRef.current.select();
      }
    }, 50);
  }, [open, selectedRallyId]);

  if (!open) return null;

  const isNewRally = selectedRallyId === 'new';
  const canCreate = editionName.trim().length > 0 && (!isNewRally || newRallyName.trim().length > 0);

  const handleCreate = () => {
    if (!canCreate) return;
    if (isNewRally) {
      addRally(newRallyName.trim(), editionName.trim());
    } else {
      selectRally(selectedRallyId);
      addEdition(editionName.trim());
    }
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <h2 style={{ margin: '0 0 16px 0' }}>New Edition</h2>

        {/* Rally selection */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'block' }}>Rally</label>
          <select
            value={selectedRallyId}
            onChange={e => setSelectedRallyId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
            }}
          >
            {rallies.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
            <option value="new">+ Create new rally</option>
          </select>
        </div>

        {/* New rally name (only when creating) */}
        {isNewRally && (
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'block' }}>Rally name</label>
            <input
              ref={rallyInputRef}
              type="text"
              value={newRallyName}
              onChange={e => setNewRallyName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canCreate && handleCreate()}
              placeholder="e.g. DJ Rally, Safari Rally..."
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '14px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Edition name */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'block' }}>Edition name</label>
          <input
            ref={editionInputRef}
            type="text"
            value={editionName}
            onChange={e => setEditionName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canCreate && handleCreate()}
            placeholder="e.g. 2024, 2025..."
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: '14px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            A day will be created automatically.
          </div>
        </div>

        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleCreate} disabled={!canCreate}>
            {isNewRally ? 'Create Rally & Edition' : 'Create Edition'}
          </button>
        </div>
      </div>
    </div>
  );
}
