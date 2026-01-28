import { useState, useEffect, useRef } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '../../state/projectStore';
import { flattenDayRows } from '../../state/storeHelpers';

interface ContextMenu {
  x: number;
  y: number;
  type: 'rally' | 'edition' | 'day';
  rallyId: string;
  editionId?: string;
  dayId?: string;
}

export default function ProjectTree() {
  const workspace = useProjectStore(s => s.workspace);
  const currentRallyId = useProjectStore(s => s.currentRallyId);
  const currentEditionId = useProjectStore(s => s.currentEditionId);
  const currentDayId = useProjectStore(s => s.currentDayId);
  const viewMode = useProjectStore(s => s.viewMode);
  const selectRally = useProjectStore(s => s.selectRally);
  const selectEdition = useProjectStore(s => s.selectEdition);
  const selectDay = useProjectStore(s => s.selectDay);
  const removeRally = useProjectStore(s => s.removeRally);
  const toggleRallyLock = useProjectStore(s => s.toggleRallyLock);
  const addDay = useProjectStore(s => s.addDay);
  const removeDay = useProjectStore(s => s.removeDay);
  const addEdition = useProjectStore(s => s.addEdition);
  const removeEdition = useProjectStore(s => s.removeEdition);
  const updateRallyName = useProjectStore(s => s.updateRallyName);
  const updateEditionName = useProjectStore(s => s.updateEditionName);
  const updateDaySettings = useProjectStore(s => s.updateDaySettings);
  const setViewMode = useProjectStore(s => s.setViewMode);

  const [menu, setMenu] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [editingRallyId, setEditingRallyId] = useState<string | null>(null);
  const [editingEditionId, setEditingEditionId] = useState<string | null>(null);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
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

  // Focus inline edit input
  useEffect(() => {
    if ((editingRallyId || editingEditionId || editingDayId) && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingRallyId, editingEditionId, editingDayId]);

  const commitRename = () => {
    if (editingRallyId && editName.trim()) {
      updateRallyName(editingRallyId, editName.trim());
    }
    if (editingEditionId && editName.trim()) {
      updateEditionName(editingEditionId, editName.trim());
    }
    if (editingDayId && editName.trim()) {
      updateDaySettings(editingDayId, { name: editName.trim() });
    }
    setEditingRallyId(null);
    setEditingEditionId(null);
    setEditingDayId(null);
  };

  const menuItemStyle: React.CSSProperties = {
    padding: '6px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    whiteSpace: 'nowrap',
  };

  const hoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = 'var(--color-bg-secondary)'),
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = 'transparent'),
  };

  const inlineEditInput = (
    <input
      ref={editInputRef}
      type="text"
      value={editName}
      onChange={e => setEditName(e.target.value)}
      onBlur={commitRename}
      onKeyDown={e => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') {
          setEditingRallyId(null);
          setEditingEditionId(null);
          setEditingDayId(null);
        }
      }}
      onClick={e => e.stopPropagation()}
      style={{
        flex: 1,
        fontSize: '13px',
        fontWeight: 600,
        padding: '2px 4px',
        minHeight: '22px',
        border: '1px solid var(--color-primary)',
        borderRadius: '4px',
        outline: 'none',
      }}
    />
  );

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
        <div style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          No rallies yet. Use "New Rally" above to get started.
        </div>
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
              onContextMenu={e => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, type: 'rally', rallyId: rally.id });
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
              {editingRallyId === rally.id ? inlineEditInput : (
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}>
                  {rally.locked && (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
                      <rect x="3" y="7" width="10" height="8" rx="1.5" fill="currentColor" />
                      <path d="M5 7V5a3 3 0 1 1 6 0v2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                  )}
                  {rally.name}
                </span>
              )}
              {editingRallyId !== rally.id && (
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {rally.editions.length} ed.
                </span>
              )}
            </div>

            {/* Expanded tree for selected rally */}
            {isSelectedRally && (
              <div style={{ paddingLeft: '12px' }}>
                {/* Node Library link */}
                <div
                  onClick={() => setViewMode('library')}
                  style={{
                    padding: '5px 8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    marginTop: '2px',
                    fontSize: '13px',
                    fontWeight: viewMode === 'library' ? 600 : 400,
                    background: viewMode === 'library' ? 'var(--color-primary-light)' : 'transparent',
                    color: viewMode === 'library' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '11px' }}>&#x1F4E6;</span> Node Library
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                    {rally.nodeLibrary.length}
                  </span>
                </div>

                {/* Editions */}
                {rally.editions.map(edition => {
                  const isSelectedEdition = edition.id === currentEditionId;

                  return (
                    <div key={edition.id} style={{ marginTop: '4px' }}>
                      {/* Edition header */}
                      <div
                        onClick={() => { if (!editingEditionId) selectEdition(edition.id); }}
                        onContextMenu={e => {
                          e.preventDefault();
                          setMenu({ x: e.clientX, y: e.clientY, type: 'edition', rallyId: rally.id, editionId: edition.id });
                        }}
                        style={{
                          padding: '5px 8px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          fontWeight: isSelectedEdition ? 600 : 500,
                          fontSize: '13px',
                          color: 'var(--color-text)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: isSelectedEdition ? 'var(--color-bg-secondary)' : 'transparent',
                        }}
                      >
                        {editingEditionId === edition.id ? inlineEditInput : (
                          <>
                            <span>{edition.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              {edition.days.length} {edition.days.length === 1 ? 'day' : 'days'}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Days under this edition */}
                      {isSelectedEdition && (
                        <div style={{ paddingLeft: '12px' }}>
                          {edition.days.map(day => {
                            const isSelectedDay = day.id === currentDayId;
                            const totalRows = flattenDayRows(day).length;

                            return (
                              <div key={day.id} style={{ marginTop: '2px' }}>
                                {/* Day header */}
                                <div
                                  onClick={() => {
                                    if (!editingDayId) {
                                      selectDay(day.id);
                                      setViewMode('routeBuilder');
                                    }
                                  }}
                                  onContextMenu={e => {
                                    e.preventDefault();
                                    setMenu({ x: e.clientX, y: e.clientY, type: 'day', rallyId: rally.id, editionId: edition.id, dayId: day.id });
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    background: isSelectedDay && viewMode !== 'library' ? 'var(--color-primary-light)' : 'transparent',
                                    fontWeight: isSelectedDay && viewMode !== 'library' ? 600 : 400,
                                    color: isSelectedDay && viewMode !== 'library' ? 'var(--color-primary)' : undefined,
                                    fontSize: '13px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  {editingDayId === day.id ? inlineEditInput : (
                                    <>
                                      <span>{day.name}</span>
                                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                        {day.nodes.length}n / {totalRows}r
                                      </span>
                                    </>
                                  )}
                                </div>

                                {/* Nodes are managed in the Route Builder, not the sidebar */}
                              </div>
                            );
                          })}

                          {/* Add day button */}
                          {!rally.locked && (
                            <div
                              onClick={() => addDay(`Day ${edition.days.length + 1}`)}
                              style={{
                                padding: '4px 8px',
                                marginTop: '2px',
                                fontSize: '12px',
                                color: 'var(--color-text-muted)',
                                cursor: 'pointer',
                                borderRadius: '4px',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                            >
                              + Add Day
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

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
            minWidth: '160px',
          }}
        >
          {/* Rally context menu */}
          {menu.type === 'rally' && (() => {
            const menuRally = workspace.rallies.find(r => r.id === menu.rallyId);
            const isLocked = menuRally?.locked === true;
            return (
              <>
                <div style={menuItemStyle} {...hoverHandlers} onClick={() => {
                  setMenu(null);
                  addEdition(new Date().getFullYear().toString());
                }}>
                  Add Edition
                </div>
                <div style={menuItemStyle} {...hoverHandlers} onClick={() => {
                  const rallyId = menu.rallyId;
                  setMenu(null);
                  toggleRallyLock(rallyId);
                }}>
                  {isLocked ? 'Unlock Rally' : 'Lock Rally'}
                </div>
                <div style={menuItemStyle} {...hoverHandlers} onClick={() => {
                  const rallyId = menu.rallyId;
                  setMenu(null);
                  setEditName(menuRally?.name ?? '');
                  setEditingRallyId(rallyId);
                }}>
                  Rename Rally
                </div>
                <div style={{ ...menuItemStyle, color: 'var(--color-danger)' }} {...hoverHandlers} onClick={async () => {
                  const rallyId = menu.rallyId;
                  setMenu(null);
                  const confirmed = await ask('Remove this rally and all its editions?', {
                    title: 'Remove Rally',
                    kind: 'warning',
                  });
                  if (confirmed) removeRally(rallyId);
                }}>
                  Remove Rally
                </div>
              </>
            );
          })()}

          {/* Edition context menu */}
          {menu.type === 'edition' && menu.editionId && (() => {
            const menuRally = workspace.rallies.find(r => r.id === menu.rallyId);
            const edition = menuRally?.editions.find(e => e.id === menu.editionId);
            return (
              <>
                <div style={menuItemStyle} {...hoverHandlers} onClick={() => {
                  const edId = menu.editionId!;
                  setMenu(null);
                  setEditName(edition?.name ?? '');
                  setEditingEditionId(edId);
                }}>
                  Rename Edition
                </div>
                {menuRally && menuRally.editions.length > 1 && !menuRally.locked && (
                  <div style={{ ...menuItemStyle, color: 'var(--color-danger)' }} {...hoverHandlers} onClick={async () => {
                    const edId = menu.editionId!;
                    setMenu(null);
                    const confirmed = await ask('Remove this edition and all its days?', {
                      title: 'Remove Edition',
                      kind: 'warning',
                    });
                    if (confirmed) removeEdition(edId);
                  }}>
                    Remove Edition
                  </div>
                )}
              </>
            );
          })()}

          {/* Day context menu */}
          {menu.type === 'day' && menu.dayId && (() => {
            const menuRally = workspace.rallies.find(r => r.id === menu.rallyId);
            const edition = menuRally?.editions.find(e => e.id === menu.editionId);
            const dayObj = edition?.days.find(d => d.id === menu.dayId);
            return (
              <>
                <div style={menuItemStyle} {...hoverHandlers} onClick={() => {
                  const dayId = menu.dayId!;
                  setMenu(null);
                  setEditName(dayObj?.name ?? '');
                  setEditingDayId(dayId);
                }}>
                  Rename Day
                </div>
                {!menuRally?.locked && (() => {
                  const isLastDay = edition != null && edition.days.length <= 1;
                  return (
                    <div style={{
                      ...menuItemStyle,
                      color: isLastDay ? 'var(--color-text-muted)' : 'var(--color-danger)',
                      cursor: isLastDay ? 'default' : 'pointer',
                      opacity: isLastDay ? 0.5 : 1,
                    }} {...(isLastDay ? {} : hoverHandlers)} onClick={async () => {
                      if (isLastDay) return;
                      const dayId = menu.dayId!;
                      setMenu(null);
                      const confirmed = await ask('Remove this day and all its nodes?', {
                        title: 'Remove Day',
                        kind: 'warning',
                      });
                      if (confirmed) removeDay(dayId);
                    }}>
                      Remove Day
                    </div>
                  );
                })()}
              </>
            );
          })()}

          {/* Node context menus are in the Route Builder, not the sidebar */}
        </div>
      )}
    </div>
  );
}
