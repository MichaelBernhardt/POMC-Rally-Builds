import { useState } from 'react';
import { useProjectStore } from '../../state/projectStore';

interface NewRallyDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function NewRallyDialog({ open, onClose }: NewRallyDialogProps) {
  const [name, setName] = useState('My Rally');
  const addRally = useProjectStore(s => s.addRally);

  if (!open) return null;

  const handleCreate = () => {
    if (!name.trim()) return;
    addRally(name.trim());
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h2>New Rally</h2>
        <div className="form-group">
          <label>Rally Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          A default edition ({new Date().getFullYear()}) with one day will be created.
        </div>
        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleCreate} disabled={!name.trim()}>
            Create Rally
          </button>
        </div>
      </div>
    </div>
  );
}
