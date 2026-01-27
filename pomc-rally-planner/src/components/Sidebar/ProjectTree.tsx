import { useState, useEffect, useRef } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '../../state/projectStore';

interface ContextMenu {
  x: number;
  y: number;
  type: 'rally' | 'day';
  rallyId: string;
  dayId?: string;
}

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

  const [menu, setMenu] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [editingRallyId, setEditingRallyId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!menu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menu]);

  // Focus the inline edit input when editing starts
  useEffect(() => {
    if (editingRallyId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingRallyId]);

  const commitRename = () => {
    if (editingRallyId && editName.trim()) {
      updateRallyName(editingRallyId, editName.trim());
    }
    setEditingRallyId(null);
  };

  const handleRallyContext = (e: React.MouseEvent, rallyId: string) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, type: 'rally', rallyId });
  };

  const handleDayContext = (e: React.MouseEvent, rallyId: string, dayId: string) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, type: 'day', rallyId, dayId });
  };

  const menuItemStyle: React.CSSProperties = {
    padding: '6px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap',
  };

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
            addRally('New Rally');
            const state = useProjectStore.getState();
            setEditName('New Rally');
            setEditingRallyId(state.currentRallyId);
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
              onClick={() => { if (!editingRallyId) selectRally(rally.id); }}
              onContextMenu={e => handleRallyContext(e, rally.id)}
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
              {editingRallyId === rally.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingRallyId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    flex: 1,
                    fontSize: '14px',
                    fontWeight: 600,
                    padding: '2px 4px',
                    minHeight: '24px',
                    border: '1px solid var(--color-primary)',
                    borderRadius: '4px',
                    outline: 'none',
                  }}
                />
              ) : (
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {rally.name}
                </span>
              )}
              {editingRallyId !== rally.id && (
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {rally.days.length} {rally.days.length === 1 ? 'day' : 'days'}
                </span>
              )}
            </div>

            {/* Days under this rally */}
            {isSelectedRally && (
              <div style={{ paddingLeft: '12px' }}>
                {rally.days.map(day => (
                  <div
                    key={day.id}
                    onClick={() => selectRallyDay(rally.id, day.id)}
                    onContextMenu={e => handleDayContext(e, rally.id, day.id)}
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

                {/* Add day button */}
                <div style={{ marginTop: '4px' }}>
                  <button
                    onClick={() => addDay(`Day ${rally.days.length + 1}`)}
                    style={{ width: '100%', fontSize: '12px', padding: '4px 8px', minHeight: '28px' }}
                  >
                    + Day
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add rally button */}
      <div style={{ marginTop: '8px', padding: '0 4px' }}>
        <button
          onClick={() => {
            addRally('New Rally');
            const state = useProjectStore.getState();
            setEditName('New Rally');
            setEditingRallyId(state.currentRallyId);
          }}
          style={{ width: '100%', fontSize: '13px' }}
        >
          + Add Rally
        </button>
      </div>

      {/* Context menu */}
      {menu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: menu.x,
            top: menu.y,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            padding: '4px 0',
            minWidth: '140px',
          }}
        >
          {menu.type === 'rally' && (
            <>
              <div
                style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => {
                  const rallyId = menu.rallyId;
                  const rally = workspace.rallies.find(r => r.id === rallyId);
                  setMenu(null);
                  setEditName(rally?.name ?? '');
                  setEditingRallyId(rallyId);
                }}
              >
                Rename Rally
              </div>
              <div
                style={{ ...menuItemStyle, color: 'var(--color-danger)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={async () => {
                  const rallyId = menu.rallyId;
                  setMenu(null);
                  const confirmed = await ask('Remove this rally and all its days?', {
                    title: 'Remove Rally',
                    kind: 'warning',
                  });
                  if (confirmed) removeRally(rallyId);
                }}
              >
                Remove Rally
              </div>
            </>
          )}
          {menu.type === 'day' && menu.dayId && (
            <div
              style={{ ...menuItemStyle, color: 'var(--color-danger)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={async () => {
                const rallyId = menu.rallyId;
                const dayId = menu.dayId!;
                setMenu(null);
                const rally = workspace.rallies.find(r => r.id === rallyId);
                if (rally && rally.days.length <= 1) {
                  await ask('Cannot remove the last day in a rally.', { title: 'Remove Day', kind: 'info' });
                  return;
                }
                const confirmed = await ask('Remove this day and all its rows?', {
                  title: 'Remove Day',
                  kind: 'warning',
                });
                if (confirmed) removeDay(dayId);
              }}
            >
              Remove Day
            </div>
          )}
        </div>
      )}
    </div>
  );
}
