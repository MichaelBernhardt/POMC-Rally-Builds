import { useState, useCallback, useEffect, useRef } from 'react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { GridApi } from 'ag-grid-community';
import { useProjectStore } from '../../state/projectStore';
import RouteGrid from '../Grid/RouteGrid';
import ProjectTree from '../Sidebar/ProjectTree';
import DayPanel from '../Sidebar/DayPanel';
import Toolbar from './Toolbar';
import StatusBar from '../StatusBar';
import NewRallyDialog from '../Dialogs/NewProjectDialog';
import ImportCsvDialog from '../Dialogs/ImportCsvDialog';
import ExportDialog from '../Dialogs/ExportDialog';
import SpeedTableDialog from '../Dialogs/SpeedTableDialog';
import { detectFileVersion, migrateV1ToWorkspace } from '../../engine/migration';
import { RallyProjectV1 } from '../../types/domain';

const LAST_FILE_KEY = 'pomc:lastFilePath';

export default function AppShell() {
  const [showNewRally, setShowNewRally] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSpeedTable, setShowSpeedTable] = useState(false);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const workspace = useProjectStore(s => s.workspace);
  const filePath = useProjectStore(s => s.filePath);
  const isDirty = useProjectStore(s => s.isDirty);
  const loadWorkspace = useProjectStore(s => s.loadWorkspace);
  const setFilePath = useProjectStore(s => s.setFilePath);
  const markSaved = useProjectStore(s => s.markSaved);
  const getWorkspaceForSave = useProjectStore(s => s.getWorkspaceForSave);
  const getCurrentRally = useProjectStore(s => s.getCurrentRally);
  const undo = useProjectStore(s => s.undo);
  const redo = useProjectStore(s => s.redo);

  // Auto-load last workspace on startup
  useEffect(() => {
    const lastPath = localStorage.getItem(LAST_FILE_KEY);
    if (!lastPath) return;

    readTextFile(lastPath)
      .then(content => {
        const data = JSON.parse(content);
        const version = detectFileVersion(data);
        if (version === 1) {
          const ws = migrateV1ToWorkspace(data as RallyProjectV1);
          loadWorkspace(ws, lastPath);
          useProjectStore.setState({ isDirty: true });
        } else {
          loadWorkspace(data, lastPath);
        }
      })
      .catch(() => {
        // File no longer exists or unreadable — clear stale path
        localStorage.removeItem(LAST_FILE_KEY);
      });
  }, []);

  // Auto-save timer
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      const state = useProjectStore.getState();
      if (state.workspace && state.filePath && state.isDirty) {
        const data = state.getWorkspaceForSave();
        if (data) {
          const backupPath = state.filePath.replace(/\.rally\.json$/, '.backup.json');
          writeTextFile(backupPath, JSON.stringify(data, null, 2)).catch(console.error);
        }
      }
    }, 30000);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 's') {
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
        useProjectStore.getState().addRow();
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
    if (version === 1) {
      const ws = migrateV1ToWorkspace(data as RallyProjectV1);
      loadWorkspace(ws, path);
      // Mark dirty so saving converts to v2 format
      useProjectStore.setState({ isDirty: true });
    } else {
      loadWorkspace(data, path);
    }
    localStorage.setItem(LAST_FILE_KEY, path);
  }, [loadWorkspace]);

  const handleGridReady = useCallback((api: GridApi) => {
    setGridApi(api);
  }, []);

  const currentRally = getCurrentRally();

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
        <button onClick={() => setShowNewRally(true)}>New Rally</button>
        <button onClick={handleOpen}>Open</button>
        <button onClick={handleSave} disabled={!workspace}>Save</button>

        <div style={{ width: '1px', height: '28px', background: 'var(--color-border)', margin: '0 4px' }} />

        <button onClick={() => setShowImport(true)} disabled={!currentRally}>Import</button>
        <button onClick={() => setShowExport(true)} disabled={!currentRally}>Export</button>

        <div style={{ flex: 1 }} />

        <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-text)' }}>
          POMC Rally Planner
        </span>

        <div style={{ flex: 1 }} />

        <button onClick={() => setShowSpeedTable(true)} disabled={!currentRally}>
          Speed Tables
        </button>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: 'var(--sidebar-width)',
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-bg-sidebar)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}>
          <ProjectTree />
          <div style={{ flex: 1 }} />
          <DayPanel />
        </div>

        {/* Grid area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Toolbar
            gridApi={gridApi}
            onImport={() => setShowImport(true)}
            onExport={() => setShowExport(true)}
          />

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {currentRally ? (
              <RouteGrid onGridReady={handleGridReady} />
            ) : (
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
                <div>Create a new rally or open an existing workspace to get started.</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button className="primary" onClick={() => setShowNewRally(true)}>
                    New Rally
                  </button>
                  <button onClick={handleOpen}>
                    Open Workspace
                  </button>
                </div>
              </div>
            )}
          </div>

          <StatusBar />
        </div>
      </div>

      {/* Dialogs */}
      <NewRallyDialog open={showNewRally} onClose={() => setShowNewRally(false)} />
      <ImportCsvDialog open={showImport} onClose={() => setShowImport(false)} />
      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
      <SpeedTableDialog open={showSpeedTable} onClose={() => setShowSpeedTable(false)} />
    </div>
  );
}
