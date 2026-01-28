import { useState, useCallback, useEffect, useRef } from 'react';
import { open as openDialog, save as saveDialog, ask } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { GridApi } from 'ag-grid-community';
import { useProjectStore } from '../../state/projectStore';
import RouteGrid from '../Grid/RouteGrid';
import ProjectTree from '../Sidebar/ProjectTree';
import DayPanel from '../Sidebar/DayPanel';
import Toolbar from './Toolbar';
import StatusBar from '../StatusBar';
import NewEditionDialog from '../Dialogs/NewProjectDialog';
import ImportCsvDialog from '../Dialogs/ImportCsvDialog';
import SpeedTableDialog from '../Dialogs/SpeedTableDialog';
import NodeLibraryPanel from '../NodeLibrary/NodeLibraryPanel';
import NodeTemplateEditor from '../NodeLibrary/NodeTemplateEditor';
import RouteBuilder from '../RouteBuilder/RouteBuilder';
import { detectFileVersion, migrateV1ToWorkspace, migrateV2ToV3 } from '../../engine/migration';
import { RallyProjectV1, RallyWorkspace, RallyWorkspaceV3 } from '../../types/domain';

const LAST_FILE_KEY = 'pomc:lastFilePath';

function migrateToV3(data: unknown): RallyWorkspaceV3 {
  const version = detectFileVersion(data);
  if (version === 1) {
    const v2 = migrateV1ToWorkspace(data as RallyProjectV1);
    return migrateV2ToV3(v2);
  }
  if (version === 2) {
    return migrateV2ToV3(data as RallyWorkspace);
  }
  return data as RallyWorkspaceV3;
}

export default function AppShell() {
  const [showNewRally, setShowNewRally] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSpeedTable, setShowSpeedTable] = useState(false);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const workspace = useProjectStore(s => s.workspace);
  const filePath = useProjectStore(s => s.filePath);
  const isDirty = useProjectStore(s => s.isDirty);
  const loadWorkspace = useProjectStore(s => s.loadWorkspace);
  const setFilePath = useProjectStore(s => s.setFilePath);
  const markSaved = useProjectStore(s => s.markSaved);
  const getWorkspaceForSave = useProjectStore(s => s.getWorkspaceForSave);
  const resetWorkspace = useProjectStore(s => s.resetWorkspace);
  const currentRally = useProjectStore(s => s.getCurrentRally());
  const undo = useProjectStore(s => s.undo);
  const redo = useProjectStore(s => s.redo);
  const viewMode = useProjectStore(s => s.viewMode);
  const routeBuilderTab = useProjectStore(s => s.routeBuilderTab);
  const editingTemplateId = useProjectStore(s => s.editingTemplateId);
  const setViewMode = useProjectStore(s => s.setViewMode);

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
        const ws = migrateToV3(data);
        loadWorkspace(ws, lastPath);
        if (version < 3) {
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
        if (!s.isCurrentRallyLocked() && s.viewMode === 'grid') s.addRow();
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

  const handleSave = useCallback(async () => {
    const data = getWorkspaceForSave();
    if (!data) return;

    let savePath = filePath;
    if (!savePath) {
      const firstRallyName = data.rallies[0]?.name ?? 'workspace';
      const selected = await saveDialog({
        defaultPath: `${firstRallyName}.rally.json`,
        filters: [{ name: 'Rally Workspace', extensions: ['rally.json'] }],
      });
      if (!selected) return;
      savePath = selected;
      setFilePath(savePath);
    }

    await writeTextFile(savePath, JSON.stringify(data, null, 2));
    markSaved();
    localStorage.setItem(LAST_FILE_KEY, savePath);
  }, [filePath, getWorkspaceForSave, setFilePath, markSaved]);

  const handleSaveAs = useCallback(async () => {
    const data = getWorkspaceForSave();
    if (!data) return;

    const firstRallyName = data.rallies[0]?.name ?? 'workspace';
    const selected = await saveDialog({
      defaultPath: filePath ?? `${firstRallyName}.rally.json`,
      filters: [{ name: 'Rally Workspace', extensions: ['rally.json'] }],
    });
    if (!selected) return;

    setFilePath(selected);
    await writeTextFile(selected, JSON.stringify(data, null, 2));
    markSaved();
    localStorage.setItem(LAST_FILE_KEY, selected);
  }, [filePath, getWorkspaceForSave, setFilePath, markSaved]);

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
    const ws = migrateToV3(data);
    loadWorkspace(ws, path);
    if (version < 3) {
      useProjectStore.setState({ isDirty: true });
    }
    localStorage.setItem(LAST_FILE_KEY, path);
  }, [loadWorkspace]);

  const handleGridReady = useCallback((api: GridApi) => {
    setGridApi(api);
  }, []);

  const isLocked = currentRally?.locked === true;

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
            {viewMode === 'routeBuilder' && <span> / Route Builder</span>}
            {viewMode === 'library' && <span> / Node Library</span>}
            {viewMode === 'grid' && editingTemplateId && <span> / Template Editor</span>}
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

        {viewMode === 'grid' && editingTemplateId && (
          <button onClick={() => useProjectStore.getState().setEditingTemplate(null)}>
            Back to Library
          </button>
        )}

        <button onClick={() => setShowSpeedTable(true)} disabled={!currentRally || isLocked}>
          Speed Tables
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

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {renderMainContent()}
          </div>

          <StatusBar />
        </div>
      </div>

      {/* Dialogs */}
      <NewEditionDialog open={showNewRally} onClose={() => setShowNewRally(false)} />
      <ImportCsvDialog open={showImport} onClose={() => setShowImport(false)} />
      <SpeedTableDialog open={showSpeedTable} onClose={() => setShowSpeedTable(false)} />
    </div>
  );
}
