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
import NewProjectDialog from '../Dialogs/NewProjectDialog';
import ImportCsvDialog from '../Dialogs/ImportCsvDialog';
import ExportDialog from '../Dialogs/ExportDialog';
import SpeedTableDialog from '../Dialogs/SpeedTableDialog';

export default function AppShell() {
  const [showNewProject, setShowNewProject] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSpeedTable, setShowSpeedTable] = useState(false);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const project = useProjectStore(s => s.project);
  const filePath = useProjectStore(s => s.filePath);
  const isDirty = useProjectStore(s => s.isDirty);
  const loadProject = useProjectStore(s => s.loadProject);
  const setFilePath = useProjectStore(s => s.setFilePath);
  const markSaved = useProjectStore(s => s.markSaved);
  const getProjectForSave = useProjectStore(s => s.getProjectForSave);
  const undo = useProjectStore(s => s.undo);
  const redo = useProjectStore(s => s.redo);

  // Auto-save timer
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      const state = useProjectStore.getState();
      if (state.project && state.filePath && state.isDirty) {
        const data = state.getProjectForSave();
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
    const data = getProjectForSave();
    if (!data) return;

    let savePath = filePath;
    if (!savePath) {
      const selected = await saveDialog({
        defaultPath: `${data.name}.rally.json`,
        filters: [{ name: 'Rally Project', extensions: ['rally.json'] }],
      });
      if (!selected) return;
      savePath = selected;
      setFilePath(savePath);
    }

    await writeTextFile(savePath, JSON.stringify(data, null, 2));
    markSaved();
  }, [filePath, getProjectForSave, setFilePath, markSaved]);

  const handleOpen = useCallback(async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Rally Project', extensions: ['rally.json'] }],
    });
    if (!selected) return;

    const path = typeof selected === 'string' ? selected : selected;
    const content = await readTextFile(path);
    const data = JSON.parse(content);
    loadProject(data, path);
  }, [loadProject]);

  const handleGridReady = useCallback((api: GridApi) => {
    setGridApi(api);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Menu bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        height: '40px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        gap: '4px',
      }}>
        <button style={{ minHeight: '32px', fontSize: '14px', padding: '4px 12px' }} onClick={() => setShowNewProject(true)}>
          New
        </button>
        <button style={{ minHeight: '32px', fontSize: '14px', padding: '4px 12px' }} onClick={handleOpen}>
          Open
        </button>
        <button style={{ minHeight: '32px', fontSize: '14px', padding: '4px 12px' }} onClick={handleSave} disabled={!project}>
          Save
        </button>

        <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 8px' }} />

        <button style={{ minHeight: '32px', fontSize: '14px', padding: '4px 12px' }} onClick={() => setShowImport(true)} disabled={!project}>
          Import
        </button>
        <button style={{ minHeight: '32px', fontSize: '14px', padding: '4px 12px' }} onClick={() => setShowExport(true)} disabled={!project}>
          Export
        </button>

        <div style={{ flex: 1 }} />

        <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-text)' }}>
          POMC Rally Planner
        </span>

        <div style={{ flex: 1 }} />

        <button
          style={{ minHeight: '32px', fontSize: '14px', padding: '4px 12px' }}
          onClick={() => setShowSpeedTable(true)}
          disabled={!project}
        >
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
            {project ? (
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
                <div>Create a new project or open an existing one to get started.</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button className="primary" onClick={() => setShowNewProject(true)}>
                    New Project
                  </button>
                  <button onClick={handleOpen}>
                    Open Project
                  </button>
                </div>
              </div>
            )}
          </div>

          <StatusBar />
        </div>
      </div>

      {/* Dialogs */}
      <NewProjectDialog open={showNewProject} onClose={() => setShowNewProject(false)} />
      <ImportCsvDialog open={showImport} onClose={() => setShowImport(false)} />
      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
      <SpeedTableDialog open={showSpeedTable} onClose={() => setShowSpeedTable(false)} />
    </div>
  );
}
