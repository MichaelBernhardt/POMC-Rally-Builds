import { useState } from 'react';
import { useProjectStore } from '../../state/projectStore';

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const [name, setName] = useState('My Rally');
  const newProject = useProjectStore(s => s.newProject);

  if (!open) return null;

  const handleCreate = () => {
    if (!name.trim()) return;
    newProject(name.trim());
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h2>New Project</h2>
        <div className="form-group">
          <label>Project Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>
        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleCreate} disabled={!name.trim()}>
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
