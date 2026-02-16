import { useState, useCallback, useEffect, useRef } from 'react';
import { open as openDialog, save as saveDialog, ask } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { GridApi } from 'ag-grid-community';
import { useProjectStore, selectCurrentRally, selectIsCurrentEditionLocked } from '../../state/projectStore';
import RouteGrid from '../Grid/RouteGrid';
import ProjectTree from '../Sidebar/ProjectTree';
import DayPanel from '../Sidebar/DayPanel';
import Toolbar from './Toolbar';
import StatusBar from '../StatusBar';
import NewEditionDialog from '../Dialogs/NewProjectDialog';
import ImportCsvDialog from '../Dialogs/ImportCsvDialog';
import NodeLibraryPanel from '../NodeLibrary/NodeLibraryPanel';
import NodeTemplateEditor from '../NodeLibrary/NodeTemplateEditor';
import RouteBuilder from '../RouteBuilder/RouteBuilder';
import SpeedTablePage from '../Dialogs/SpeedTableDialog';
import { detectFileVersion, migrateV1ToWorkspace, migrateV2ToV3, migrateV3ToV4 } from '../../engine/migration';
import { RallyProjectV1, RallyWorkspace, RallyWorkspaceV3 } from '../../types/domain';

const LAST_FILE_KEY = 'pomc:lastFilePath';

function migrateToLatest(data: unknown): RallyWorkspaceV3 {
  const version = detectFileVersion(data);
  let ws: RallyWorkspaceV3;
  if (version === 1) {
    const v2 = migrateV1ToWorkspace(data as RallyProjectV1);
    ws = migrateV2ToV3(v2);
  } else if (version === 2) {
    ws = migrateV2ToV3(data as RallyWorkspace);
  } else {
    ws = data as RallyWorkspaceV3;
  }
  // Always run V4 migration — it's idempotent and handles back-filling
  // template lat/long history from route nodes for files saved before the fix.
  ws = migrateV3ToV4(ws);
  return ws;
}

export default function AppShell() {
  const [showNewRally, setShowNewRally] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const workspace = useProjectStore(s => s.workspace);
  const filePath = useProjectStore(s => s.filePath);
  const isDirty = useProjectStore(s => s.isDirty);
  const loadWorkspace = useProjectStore(s => s.loadWorkspace);
  const setFilePath = useProjectStore(s => s.setFilePath);
  const markSaved = useProjectStore(s => s.markSaved);
  const getWorkspaceForSave = useProjectStore(s => s.getWorkspaceForSave);
  const resetWorkspace = useProjectStore(s => s.resetWorkspace);
  const currentRally = useProjectStore(selectCurrentRally);
  const undo = useProjectStore(s => s.undo);
  const redo = useProjectStore(s => s.redo);
  const viewMode = useProjectStore(s => s.viewMode);
  const routeBuilderTab = useProjectStore(s => s.routeBuilderTab);
  const editingTemplateId = useProjectStore(s => s.editingTemplateId);
  const setViewMode = useProjectStore(s => s.setViewMode);
  const isLocked = useProjectStore(selectIsCurrentEditionLocked);

  // Auto-hide sidebar when Route Builder is in table view
  useEffect(() => {
    if (viewMode === 'routeBuilder' && routeBuilderTab === 'table') {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [viewMode, routeBuilderTab]);

  // Auto-load last workspace on startup
  useEffect(() => {
    const lastPath = localStorage.getItem(LAST_FILE_KEY);
    if (!lastPath) return;

    readTextFile(lastPath)
      .then(content => {
        const data = JSON.parse(content);
        const version = detectFileVersion(data);
        const ws = migrateToLatest(data);
        loadWorkspace(ws, lastPath);
        if (version <= 4) {
          useProjectStore.setState({ isDirty: true });
        }
      })
      .catch(() => {
        localStorage.removeItem(LAST_FILE_KEY);
      });
  }, []);

  // Auto-save to main file when dirty (every 5 seconds)
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      const state = useProjectStore.getState();
      if (state.workspace && state.filePath && state.isDirty) {
        const data = state.getWorkspaceForSave();
        if (data) {
          writeTextFile(state.filePath, JSON.stringify(data, null, 2))
            .then(() => state.markSaved())
            .catch(console.error);
        }
      }
    }, 5000);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.shiftKey && e.key === 's') {
        e.preventDefault();
        handleSaveAs();
      } else if (ctrl && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Insert' && !ctrl) {
        e.preventDefault();
        const s = useProjectStore.getState();
        if (!s.isCurrentEditionLocked() && s.viewMode === 'grid') s.addRow();
      } else if (e.key === 'Escape') {
        const s = useProjectStore.getState();
        if (s.editingTemplateId) {
          s.setEditingTemplate(null);
        } else if (s.viewMode === 'grid') {
          s.setViewMode('routeBuilder');
        } else if (s.viewMode === 'routeBuilder') {
          // stay at routeBuilder level
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSave = useCallback(async () => {
    const data = getWorkspaceForSave();
    if (!data) return;

    let savePath = filePath;
    if (!savePath) {
      const firstRallyName = data.rallies[0]?.name ?? 'workspace';
      const selected = await saveDialog({
        defaultPath: firstRallyName,
        filters: [{ name: 'Rally Workspace', extensions: ['rally.json'] }],
      });
      if (!selected) return;
      savePath = selected;
      setFilePath(savePath);
    }

    const changeCount = useProjectStore.getState().undoStack.length;
    await writeTextFile(savePath, JSON.stringify(data, null, 2));
    markSaved();
    localStorage.setItem(LAST_FILE_KEY, savePath);
    showToast(`Saved! ${changeCount} change${changeCount !== 1 ? 's' : ''}`);
  }, [filePath, getWorkspaceForSave, setFilePath, markSaved, showToast]);

  const handleSaveAs = useCallback(async () => {
    const data = getWorkspaceForSave();
    if (!data) return;

    const firstRallyName = data.rallies[0]?.name ?? 'workspace';
    // Strip .rally.json from existing path so the dialog filter doesn't double it
    const basePath = filePath?.replace(/\.rally\.json$/i, '') ?? firstRallyName;
    const selected = await saveDialog({
      defaultPath: basePath,
      filters: [{ name: 'Rally Workspace', extensions: ['rally.json'] }],
    });
    if (!selected) return;

    const changeCount = useProjectStore.getState().undoStack.length;
    setFilePath(selected);
    await writeTextFile(selected, JSON.stringify(data, null, 2));
    markSaved();
    localStorage.setItem(LAST_FILE_KEY, selected);
    showToast(`Saved! ${changeCount} change${changeCount !== 1 ? 's' : ''}`);
  }, [filePath, getWorkspaceForSave, setFilePath, markSaved, showToast]);

  const handleNewWorkspace = useCallback(async () => {
    if (isDirty) {
      const confirmed = await ask('You have unsaved changes. Discard them and start a new workspace?', {
        title: 'New Workspace',
        kind: 'warning',
      });
      if (!confirmed) return;
    }
    resetWorkspace();
    localStorage.removeItem(LAST_FILE_KEY);
  }, [isDirty, resetWorkspace]);

  const handleOpen = useCallback(async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Rally Workspace', extensions: ['rally.json'] }],
    });
    if (!selected) return;

    const path = typeof selected === 'string' ? selected : selected;
    const content = await readTextFile(path);
    const data = JSON.parse(content);

    const version = detectFileVersion(data);
    const ws = migrateToLatest(data);
    loadWorkspace(ws, path);
    if (version <= 4) {
      useProjectStore.setState({ isDirty: true });
    }
    localStorage.setItem(LAST_FILE_KEY, path);
  }, [loadWorkspace]);

  const handleGridReady = useCallback((api: GridApi) => {
    setGridApi(api);
  }, []);

  const renderMainContent = () => {
    if (!currentRally) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--color-text-muted)',
          fontSize: '18px',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>POMC Rally Planner</div>
          <div>Create a new edition or open an existing workspace to get started.</div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button className="primary" onClick={() => setShowNewRally(true)}>
              New Edition
            </button>
            <button onClick={handleOpen}>
              Open Workspace
            </button>
          </div>
        </div>
      );
    }

    if (viewMode === 'speedTables') {
      return <SpeedTablePage />;
    }

    if (viewMode === 'library') {
      if (editingTemplateId) {
        return <NodeTemplateEditor />;
      }
      return <NodeLibraryPanel />;
    }

    if (viewMode === 'routeBuilder') {
      return <RouteBuilder />;
    }

    // Default: grid view
    return <RouteGrid onGridReady={handleGridReady} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Menu bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        gap: '8px',
      }}>
        <button onClick={handleNewWorkspace}>New Workspace</button>
        <div style={{ width: '1px', height: '28px', background: 'var(--color-border)', margin: '0 4px' }} />
        <button onClick={() => setShowNewRally(true)}>New Edition</button>
        <button onClick={handleOpen}>Open</button>
        <button onClick={handleSave} disabled={!workspace}>Save</button>
        <button onClick={handleSaveAs} disabled={!workspace}>Save As</button>

        <div style={{ flex: 1 }} />

        {/* Breadcrumb */}
        {currentRally && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{currentRally.name}</span>
            {isLocked && viewMode !== 'library' && viewMode !== 'speedTables' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B',
                borderRadius: '4px', padding: '1px 6px', fontSize: '11px', fontWeight: 600,
                marginLeft: '4px',
              }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="7" width="10" height="8" rx="1.5" fill="currentColor" />
                  <path d="M5 7V5a3 3 0 1 1 6 0v2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                Locked
              </span>
            )}
            {viewMode === 'routeBuilder' && <span> / Route Builder</span>}
            {viewMode === 'speedTables' && <span> / Speed Tables</span>}
            {viewMode === 'library' && <span> / Node Library</span>}
            {viewMode === 'library' && editingTemplateId && <span> / Template Editor</span>}
            {viewMode === 'grid' && !editingTemplateId && (
              <>
                {(() => {
                  const edition = useProjectStore.getState().getCurrentEdition();
                  const day = useProjectStore.getState().getCurrentDay();
                  const node = useProjectStore.getState().getCurrentNode();
                  return (
                    <>
                      {edition && <span> / {edition.name}</span>}
                      {day && <span> / {day.name}</span>}
                      {node && <span> / {node.name}</span>}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {viewMode === 'library' && editingTemplateId && (
          <button onClick={() => useProjectStore.getState().setEditingTemplate(null)}>
            Back to Library
          </button>
        )}

        <button
          onClick={() => setShowAbout(true)}
          title="About POMC Rally Planner"
          style={{
            padding: '4px 10px',
            fontSize: '13px',
            minHeight: 'auto',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ?
        </button>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: sidebarOpen ? 'var(--sidebar-width)' : '0px',
          minWidth: sidebarOpen ? 'var(--sidebar-width)' : '0px',
          borderRight: sidebarOpen ? '1px solid var(--color-border)' : 'none',
          background: 'var(--color-bg-sidebar)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.2s ease, min-width 0.2s ease',
        }}>
          <div style={{ width: 'var(--sidebar-width)', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <ProjectTree />
            <div style={{ flex: 1 }} />
            <DayPanel />
          </div>
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          style={{
            width: '20px',
            minWidth: '20px',
            border: 'none',
            borderRight: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            fontSize: '12px',
            color: 'var(--color-text-muted)',
          }}
        >
          {sidebarOpen ? '\u25C0' : '\u25B6'}
        </button>

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {viewMode === 'grid' && currentRally && (
            <Toolbar
              gridApi={gridApi}
              onImport={() => setShowImport(true)}
            />
          )}

          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {renderMainContent()}
            {isLocked && viewMode !== 'library' && viewMode !== 'speedTables' && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0, 0, 0, 0.06)',
                pointerEvents: 'none',
                zIndex: 1,
              }} />
            )}
          </div>

          <StatusBar />
        </div>
      </div>

      {/* Dialogs */}
      <NewEditionDialog open={showNewRally} onClose={() => setShowNewRally(false)} />
      <ImportCsvDialog open={showImport} onClose={() => setShowImport(false)} />

      {/* About dialog */}
      {showAbout && (
        <div className="dialog-overlay" onClick={() => setShowAbout(false)}>
          <div
            className="dialog"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '560px', maxHeight: '80vh', overflow: 'auto' }}
          >
            <h2 style={{ marginTop: 0 }}>POMC Rally Planner <span style={{ fontWeight: 400, fontSize: '14px', color: 'var(--color-text-muted)' }}>v1.3.0</span></h2>

            <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--color-text-secondary)' }}>
              <p style={{ marginTop: 0 }}>
                A route planning tool for POMC regularity rallies. Build routes from reusable nodes,
                manage speed tables, and refine distances through reconnaissance.
              </p>

              <h3 style={{ fontSize: '15px', color: 'var(--color-text)', marginBottom: '6px' }}>Workflow</h3>
              <ol style={{ paddingLeft: '20px', margin: '0 0 16px 0' }}>
                <li><strong>Set up Speed Tables</strong> — define how A-speeds map to B, C, D speeds for each terrain type.</li>
                <li><strong>Build Node Templates</strong> — create reusable route sections in the Node Library with instructions, distances, and speed settings.</li>
                <li><strong>Assemble Routes</strong> — drag nodes into a day's route in the Route Builder. Switch to Table view to fine-tune.</li>
                <li><strong>Reconnaissance</strong> — enable Recon Mode to record measured distances. Grey suggestions estimate check distances based on drift from previous rows.</li>
                <li><strong>Push to Library</strong> — after recon, push changes back to update node templates. Rally distances are averaged from the last 3 recordings.</li>
                <li><strong>Export</strong> — export the final route as CSV for timing systems.</li>
              </ol>

              <h3 style={{ fontSize: '15px', color: 'var(--color-text)', marginBottom: '6px' }}>Key Features</h3>
              <ul style={{ paddingLeft: '20px', margin: '0 0 16px 0' }}>
                <li><strong>Node Library</strong> — reusable route sections shared across editions. Define connection rules so nodes chain correctly.</li>
                <li><strong>Speed Tables</strong> — per-rally lookup tables mapping terrain type and A-speed to all speed groups.</li>
                <li><strong>Recon Mode</strong> — record measured distances in the field. Inline suggestions help estimate upcoming checkpoints.</li>
                <li><strong>Distance History</strong> — each push records recon distances. Rally distances converge to the average of the last 3 recordings.</li>
                <li><strong>Edition Locking</strong> — right-click an edition to lock it, preventing accidental edits to finalised routes.</li>
                <li><strong>Undo / Redo</strong> — Ctrl+Z / Ctrl+Y for all editing operations.</li>
                <li><strong>Auto-save</strong> — changes are automatically saved every 5 seconds.</li>
              </ul>

              <h3 style={{ fontSize: '15px', color: 'var(--color-text)', marginBottom: '6px' }}>Type Codes</h3>
              <p style={{ margin: '0 0 8px 0' }}>
                <strong>o</strong> = Open &nbsp; <strong>f</strong> = Flat &nbsp; <strong>d</strong> = Downhill &nbsp;
                <strong>u</strong> = Uphill &nbsp; <strong>l</strong> = Speed Limit &nbsp; <strong>m</strong> = Marked Control &nbsp;
                <strong>t</strong> = Time Add
              </p>
              <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Only rows with a type code are included in the CSV export.
              </p>

              <h3 style={{ fontSize: '15px', color: 'var(--color-text)', marginBottom: '6px' }}>Tips</h3>
              <ul style={{ paddingLeft: '20px', margin: '0 0 8px 0' }}>
                <li>Right-click rallies, editions, and days in the sidebar for rename, lock, and delete options.</li>
                <li>Use <strong>Recalc Times</strong> to recompute first/last car arrival times after editing speeds or distances.</li>
                <li>Use <strong>Clear Recon</strong> to reset check distances on the current route without pushing to library.</li>
                <li>Curly braces in instructions <code>{'{annotation}'}</code> are stripped on clean CSV export.</li>
              </ul>
            </div>

            <div className="dialog-actions" style={{ marginTop: '16px' }}>
              <button className="primary" onClick={() => setShowAbout(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#333',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 9999,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
