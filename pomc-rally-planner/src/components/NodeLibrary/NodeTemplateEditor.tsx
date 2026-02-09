import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  CellEditingStoppedEvent,
  GetRowIdParams,
  GridApi,
  RowClassRules,
  GridReadyEvent,
  themeAlpine,
} from 'ag-grid-community';
import { getColumnDefs } from '../Grid/GridColumns';
import { RouteRow } from '../../types/domain';
import { useProjectStore, selectCurrentRally, selectCurrentRows, selectIsCurrentRallyLocked } from '../../state/projectStore';
import { validateTemplate } from '../../engine/validator';
import '../../styles/grid-theme.css';

// Module-level clipboard that persists across template switches
let rowClipboard: RouteRow[] = [];
let clipboardMode: 'copy' | 'cut' = 'copy';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function NodeTemplateEditor() {
  const gridRef = useRef<AgGridReact<RouteRow>>(null);
  const gridApiRef = useRef<GridApi | null>(null);
  const editingTemplateId = useProjectStore(s => s.editingTemplateId);
  const rally = useProjectStore(selectCurrentRally);
  const updateNodeTemplate = useProjectStore(s => s.updateNodeTemplate);
  const setAllowedPreviousNodes = useProjectStore(s => s.setAllowedPreviousNodes);
  const setEditingTemplate = useProjectStore(s => s.setEditingTemplate);
  const rows = useProjectStore(selectCurrentRows);
  const isLocked = useProjectStore(selectIsCurrentRallyLocked);
  const updateRow = useProjectStore(s => s.updateRow);
  const pushUndo = useProjectStore(s => s.pushUndo);
  const addRow = useProjectStore(s => s.addRow);
  const deleteRows = useProjectStore(s => s.deleteRows);
  const setRows = useProjectStore(s => s.setRows);
  const template = rally?.nodeLibrary.find(t => t.id === editingTemplateId);
  const [toast, setToast] = useState<string | null>(null);

  const getSelectedIndices = useCallback((): number[] => {
    const api = gridApiRef.current;
    if (!api) return [];
    const indices: number[] = [];
    const selected = api.getSelectedRows();
    api.forEachNode(node => {
      if (node.data && selected.includes(node.data) && node.rowIndex !== null) {
        indices.push(node.rowIndex);
      }
    });
    return indices.sort((a, b) => a - b);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleCopy = useCallback(() => {
    const indices = getSelectedIndices();
    if (indices.length === 0) return;
    rowClipboard = indices.map(i => ({ ...rows[i] }));
    clipboardMode = 'copy';
    showToast(`Copied ${indices.length} row${indices.length > 1 ? 's' : ''}`);
  }, [rows, getSelectedIndices, showToast]);

  const handleCut = useCallback(() => {
    if (isLocked) return;
    const indices = getSelectedIndices();
    if (indices.length === 0) return;
    pushUndo('Cut rows');
    rowClipboard = indices.map(i => ({ ...rows[i] }));
    clipboardMode = 'cut';
    const newRows = rows.filter((_, i) => !indices.includes(i));
    setRows(newRows);
    showToast(`Cut ${indices.length} row${indices.length > 1 ? 's' : ''}`);
  }, [rows, isLocked, getSelectedIndices, pushUndo, setRows, showToast]);

  const handlePaste = useCallback(() => {
    if (isLocked || rowClipboard.length === 0) return;
    pushUndo('Paste rows');
    const indices = getSelectedIndices();
    const insertAfter = indices.length > 0 ? Math.max(...indices) : rows.length - 1;
    const newClipRows = rowClipboard.map(r => ({ ...r, id: crypto.randomUUID() }));
    const newRows = [...rows];
    newRows.splice(insertAfter + 1, 0, ...newClipRows);
    setRows(newRows);
    showToast(`Pasted ${newClipRows.length} row${newClipRows.length > 1 ? 's' : ''}`);
  }, [rows, isLocked, getSelectedIndices, pushUndo, setRows, showToast]);

  // Keyboard shortcuts for copy/cut/paste
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only handle if this component is mounted (editing a template)
      if (!editingTemplateId) return;
      // Don't intercept if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      } else if (mod && e.key === 'x') {
        e.preventDefault();
        handleCut();
      } else if (mod && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [editingTemplateId, handleCopy, handleCut, handlePaste]);

  const columnDefs = useMemo(() => getColumnDefs(), []);

  const defaultColDef = useMemo(() => ({
    sortable: false,
    filter: false,
    resizable: true,
    suppressMovable: false,
    editable: !isLocked,
  }), [isLocked]);

  const getRowId = useCallback((params: GetRowIdParams<RouteRow>) => params.data.id, []);

  const rowClassRules = useMemo<RowClassRules<RouteRow>>(() => ({
    'row-type-export': (params) => {
      const t = params.data?.type;
      return t !== null && t !== undefined && t !== 'm' && t !== 't';
    },
    'row-type-control': (params) => params.data?.type === 'm',
    'row-type-timeadd': (params) => params.data?.type === 't',
  }), []);

  const onCellEditingStopped = useCallback((event: CellEditingStoppedEvent<RouteRow>) => {
    if (!event.data || event.rowIndex === null || event.rowIndex === undefined) return;
    const field = event.colDef.field as keyof RouteRow | undefined;
    if (!field) return;

    let newVal = event.newValue;
    let oldVal = event.oldValue;

    if (field === 'type' || field === 'suggestedType') {
      if (newVal === '' || newVal === undefined) newVal = null;
      if (oldVal === '' || oldVal === undefined) oldVal = null;
    }

    const optionalNumFields = ['bbPage', 'bbPage2', 'suggestedASpeed', 'instructionNumber', 'checkDist'];
    if (optionalNumFields.includes(field)) {
      if (newVal === '' || newVal === undefined) newVal = null;
      if (oldVal === '' || oldVal === undefined) oldVal = null;
      if (newVal !== null) newVal = parseFloat(newVal);
      if (oldVal !== null) oldVal = parseFloat(oldVal);
    }

    const requiredNumFields = [
      'rallyDistance', 'aSpeed', 'bSpeed', 'cSpeed', 'dSpeed',
      'speedLimit', 'lat', 'long',
      'addTimeA', 'addTimeB', 'addTimeC', 'addTimeD',
    ];
    if (requiredNumFields.includes(field)) {
      newVal = parseFloat(newVal) || 0;
      oldVal = parseFloat(oldVal) || 0;
    }

    // Normalize boolean fields
    if (field === 'verified') {
      newVal = newVal === true;
      oldVal = oldVal === true;
    }

    if (oldVal === newVal) return;

    pushUndo('Edit cell');
    updateRow(event.rowIndex, { [field]: newVal });
  }, [updateRow, pushUndo]);

  const theme = useMemo(() => themeAlpine.withParams({
    fontSize: 15,
    headerFontSize: 16,
    foregroundColor: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    headerBackgroundColor: '#E8E8E8',
    // headerForegroundColor not supported by ThemeDefaultParams
    oddRowBackgroundColor: '#FAFAFA',
    rowHoverColor: '#F0F4FF',
    selectedRowBackgroundColor: '#DBEAFE',
    borderColor: '#D0D0D0',
    // rowBorderColor not supported by ThemeDefaultParams
    cellHorizontalPadding: 10,
    rowHeight: 36,
    headerHeight: 42,
    // gridSize not supported by ThemeDefaultParams
  }), []);

  if (!template || !editingTemplateId) return null;

  const otherTemplates = rally?.nodeLibrary.filter(t => t.id !== editingTemplateId) ?? [];
  const warnings = validateTemplate(template);
  const hasNameWarning = warnings.some(w => w.field === 'name');
  const hasConnectionWarning = warnings.some(w => w.field === 'connection');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Template header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'var(--color-bg)',
      }}>
        <button onClick={() => setEditingTemplate(null)}>Back</button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <input
            type="text"
            value={template.name}
            onChange={e => updateNodeTemplate(editingTemplateId, { name: e.target.value })}
            disabled={isLocked}
            placeholder="Node name (required)"
            style={{
              fontWeight: 600,
              fontSize: '16px',
              padding: '4px 8px',
              minWidth: '200px',
              borderColor: hasNameWarning ? 'var(--color-warning)' : undefined,
            }}
          />
          {hasNameWarning && (
            <span style={{ fontSize: '11px', color: 'var(--color-warning)', paddingLeft: '8px' }}>
              Name is required
            </span>
          )}
        </div>

        <input
          type="text"
          value={template.description}
          onChange={e => updateNodeTemplate(editingTemplateId, { description: e.target.value })}
          disabled={isLocked}
          placeholder="Description..."
          style={{ flex: 1, padding: '4px 8px', fontSize: '14px' }}
        />

        <button onClick={() => addRow()} disabled={isLocked}>+ Row</button>
        <button onClick={() => { const indices = getSelectedIndices(); if (indices.length > 0) { pushUndo('Delete rows'); deleteRows(indices); } }} disabled={isLocked}>- Row</button>

        <div style={{ width: '1px', height: '20px', background: 'var(--color-border)' }} />

        <button onClick={handleCopy} title="Copy selected rows (Ctrl+C)">Copy</button>
        <button onClick={handleCut} disabled={isLocked} title="Cut selected rows (Ctrl+X)">Cut</button>
        <button onClick={handlePaste} disabled={isLocked || rowClipboard.length === 0} title="Paste rows (Ctrl+V)">Paste</button>
      </div>

      {/* Connection rule — start node or follows one previous node (mutually exclusive) */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border)',
        background: hasConnectionWarning ? 'var(--color-warning-bg, #FFF8E1)' : 'var(--color-bg-secondary)',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, color: hasConnectionWarning ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
          Connection rule:
        </span>

        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="radio"
            name={`connRule-${editingTemplateId}`}
            checked={template.isStartNode}
            disabled={isLocked}
            onChange={() => {
              updateNodeTemplate(editingTemplateId, { isStartNode: true });
              setAllowedPreviousNodes(editingTemplateId, []);
            }}
          />
          <strong>Start node</strong>
        </label>

        {otherTemplates.length > 0 && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="radio"
                name={`connRule-${editingTemplateId}`}
                checked={!template.isStartNode && template.allowedPreviousNodes.length > 0}
                disabled={isLocked}
                onChange={() => {
                  updateNodeTemplate(editingTemplateId, { isStartNode: false });
                }}
              />
              <strong>Follows:</strong>
            </label>
            <select
              value={!template.isStartNode ? (template.allowedPreviousNodes[0] ?? '') : ''}
              disabled={isLocked || template.isStartNode}
              onChange={e => {
                updateNodeTemplate(editingTemplateId, { isStartNode: false });
                setAllowedPreviousNodes(editingTemplateId, e.target.value ? [e.target.value] : []);
              }}
              style={{
                padding: '4px 8px',
                fontSize: '13px',
                borderRadius: '4px',
                border: '1px solid var(--color-border)',
                opacity: template.isStartNode ? 0.5 : 1,
              }}
            >
              <option value="">Select a node...</option>
              {otherTemplates.map(other => (
                <option key={other.id} value={other.id}>{other.name}</option>
              ))}
            </select>
          </>
        )}

        {otherTemplates.length === 0 && !template.isStartNode && (
          <span style={{ fontSize: '12px', color: 'var(--color-warning)' }}>
            This is the only node — mark it as a start node.
          </span>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, width: '100%' }}>
        <AgGridReact<RouteRow>
          ref={gridRef}
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={getRowId}
          rowClassRules={rowClassRules}
          onCellEditingStopped={onCellEditingStopped}
          onGridReady={e => { gridApiRef.current = e.api; }}
          rowSelection="multiple"
          animateRows={false}
          undoRedoCellEditing={false}
          stopEditingWhenCellsLoseFocus={true}
          tooltipShowDelay={500}
        />
      </div>

      {/* Toast notification */}
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
    </div>
  );
}
