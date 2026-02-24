import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  CellEditingStoppedEvent,
  CellDoubleClickedEvent,
  GetRowIdParams,
  GridApi,
  RowClassRules,
  GridReadyEvent,
  themeAlpine,
} from 'ag-grid-community';
import { getColumnDefs } from '../Grid/GridColumns';
import DistanceEditDialog from '../Dialogs/DistanceEditDialog';
import { RouteRow, ReconEntry } from '../../types/domain';
import { useProjectStore, selectCurrentRally, selectCurrentRows } from '../../state/projectStore';
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
  const updateRow = useProjectStore(s => s.updateRow);
  const pushUndo = useProjectStore(s => s.pushUndo);
  const addRow = useProjectStore(s => s.addRow);
  const deleteRows = useProjectStore(s => s.deleteRows);
  const setRows = useProjectStore(s => s.setRows);
  const template = rally?.nodeLibrary.find(t => t.id === editingTemplateId);
  const [toast, setToast] = useState<string | null>(null);
  const [reconEditCell, setReconEditCell] = useState<{ index: number; value: number; field: 'rallyDistance' | 'lat' | 'long' } | null>(null);

  const onCellDoubleClicked = useCallback((event: CellDoubleClickedEvent<RouteRow>) => {
    const f = event.colDef.field;
    if ((f === 'rallyDistance' || f === 'lat' || f === 'long') && event.data && event.rowIndex != null) {
      setReconEditCell({ index: event.rowIndex, value: (event.data[f] as number) ?? 0, field: f });
    }
  }, []);

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
    const indices = getSelectedIndices();
    if (indices.length === 0) return;
    pushUndo('Cut rows');
    rowClipboard = indices.map(i => ({ ...rows[i] }));
    clipboardMode = 'cut';
    const newRows = rows.filter((_, i) => !indices.includes(i));
    setRows(newRows);
    showToast(`Cut ${indices.length} row${indices.length > 1 ? 's' : ''}`);
  }, [rows, getSelectedIndices, pushUndo, setRows, showToast]);

  const handlePaste = useCallback(() => {
    if (rowClipboard.length === 0) return;
    pushUndo('Paste rows');
    const indices = getSelectedIndices();
    const insertAfter = indices.length > 0 ? Math.max(...indices) : rows.length - 1;
    const newClipRows = rowClipboard.map(r => ({ ...r, id: crypto.randomUUID() }));
    const newRows = [...rows];
    newRows.splice(insertAfter + 1, 0, ...newClipRows);
    setRows(newRows);
    showToast(`Pasted ${newClipRows.length} row${newClipRows.length > 1 ? 's' : ''}`);
  }, [rows, getSelectedIndices, pushUndo, setRows, showToast]);

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

  const columnDefs = useMemo(() => {
    const cols = getColumnDefs()
      .filter(c => c.field !== 'firstCarTime' && c.field !== 'lastCarTime');

    // Helper to build a recon history column (editable)
    // offset: -1 = most recent (R1), -2 = second most recent (R2), -3 = oldest of last 3 (R3)
    const reconCol = (
      header: string,
      field: 'distanceHistory' | 'latHistory' | 'longHistory',
      offset: number,
      dp: number,
      width: number,
    ) => ({
      headerName: header,
      valueGetter: (params: { data?: RouteRow }) => {
        const h: ReconEntry[] = (params.data?.[field] as ReconEntry[]) ?? [];
        const idx = h.length + offset;
        if (idx < 0 || idx >= h.length) return '';
        return h[idx].value.toFixed(dp);
      },
      valueSetter: (params: { data: RouteRow; newValue: string }) => {
        const parsed = parseFloat(params.newValue);
        if (isNaN(parsed)) return false;
        const h: ReconEntry[] = [...((params.data[field] as ReconEntry[]) ?? [])];
        const idx = h.length + offset;
        if (idx < 0 || idx >= h.length) return false;
        h[idx] = { ...h[idx], value: parsed };
        // Recalculate the averaged field from the last 3 entries
        const last3 = h.slice(-3);
        const avg = last3.reduce((sum, e) => sum + e.value, 0) / last3.length;
        const updates: Partial<RouteRow> = { [field]: h };
        if (field === 'distanceHistory') {
          updates.rallyDistance = Math.round(avg * 100) / 100;
        } else if (field === 'latHistory') {
          updates.lat = Math.round(avg * 1e6) / 1e6;
        } else if (field === 'longHistory') {
          updates.long = Math.round(avg * 1e6) / 1e6;
        }
        const rowIndex = rows.findIndex(r => r.id === params.data.id);
        if (rowIndex >= 0) {
          pushUndo('Edit recon history');
          updateRow(rowIndex, updates);
        }
        return true;
      },
      tooltipValueGetter: (params: { data?: RouteRow }) => {
        const h: ReconEntry[] = (params.data?.[field] as ReconEntry[]) ?? [];
        const idx = h.length + offset;
        if (idx < 0 || idx >= h.length) return '';
        return h[idx].date;
      },
      width,
      editable: (params: { data?: RouteRow }) => {
        const h: ReconEntry[] = (params.data?.[field] as ReconEntry[]) ?? [];
        const idx = h.length + offset;
        return idx >= 0 && idx < h.length;
      },
      sortable: false,
    });

    // Insert distance recon columns after Rally Dist (R1 = most recent)
    const rallyDistIdx = cols.findIndex(c => c.field === 'rallyDistance');
    const distReconCols = [
      reconCol('Dist R1', 'distanceHistory', -1, 2, 85),
      reconCol('Dist R2', 'distanceHistory', -2, 2, 85),
      reconCol('Dist R3', 'distanceHistory', -3, 2, 85),
    ];
    if (rallyDistIdx >= 0) {
      cols.splice(rallyDistIdx + 1, 0, ...distReconCols);
    } else {
      cols.push(...distReconCols);
    }

    // Insert lat/long recon columns as interleaved pairs after the Long column
    // Result: Lat, Long, Lat R1, Long R1, Lat R2, Long R2, Lat R3, Long R3
    const longIdx = cols.findIndex(c => c.field === 'long');
    const latLongReconCols = [
      reconCol('Lat R1', 'latHistory', -1, 6, 100),
      reconCol('Long R1', 'longHistory', -1, 6, 100),
      reconCol('Lat R2', 'latHistory', -2, 6, 100),
      reconCol('Long R2', 'longHistory', -2, 6, 100),
      reconCol('Lat R3', 'latHistory', -3, 6, 100),
      reconCol('Long R3', 'longHistory', -3, 6, 100),
    ];
    if (longIdx >= 0) {
      cols.splice(longIdx + 1, 0, ...latLongReconCols);
    } else {
      cols.push(...latLongReconCols);
    }
    return cols;
  }, []);

  const defaultColDef = useMemo(() => ({
    sortable: false,
    filter: false,
    resizable: true,
    suppressMovable: false,
    editable: true,
  }), []);

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

    const optionalNumFields = ['bbPage', 'bbPage2', 'suggestedASpeed', 'instructionNumber', 'checkDist', 'checkLat', 'checkLong'];
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: '1 1 auto', maxWidth: '500px' }}>
          <input
            type="text"
            value={template.name}
            onChange={e => updateNodeTemplate(editingTemplateId, { name: e.target.value })}
            placeholder="Node name (required)"
            style={{
              fontWeight: 600,
              fontSize: '15px',
              padding: '2px 6px',
              width: '100%',
              border: '1px solid transparent',
              borderRadius: '4px',
              background: 'transparent',
              borderColor: hasNameWarning ? 'var(--color-warning)' : undefined,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = hasNameWarning ? 'var(--color-warning)' : 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-bg)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = hasNameWarning ? 'var(--color-warning)' : 'transparent'; e.currentTarget.style.background = 'transparent'; }}
          />
          <input
            type="text"
            value={template.description}
            onChange={e => updateNodeTemplate(editingTemplateId, { description: e.target.value })}
            placeholder="Description..."
            style={{
              fontSize: '12px',
              color: 'var(--color-text-muted)',
              padding: '1px 6px',
              width: '100%',
              border: '1px solid transparent',
              borderRadius: '4px',
              background: 'transparent',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-bg)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
          />
          {hasNameWarning && (
            <span style={{ fontSize: '11px', color: 'var(--color-warning)', paddingLeft: '6px' }}>
              Name is required
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={() => addRow()}>+ Row</button>
        <button onClick={() => { const indices = getSelectedIndices(); if (indices.length > 0) { pushUndo('Delete rows'); deleteRows(indices); } }}>- Row</button>

        <div style={{ width: '1px', height: '20px', background: 'var(--color-border)' }} />

        <button onClick={handleCopy} title="Copy selected rows (Ctrl+C)">Copy</button>
        <button onClick={handleCut} title="Cut selected rows (Ctrl+X)">Cut</button>
        <button onClick={handlePaste} disabled={rowClipboard.length === 0} title="Paste rows (Ctrl+V)">Paste</button>
      </div>

      {/* Connection rule — editable */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border)',
        background: hasConnectionWarning ? 'var(--color-warning-bg, #FFF8E1)' : 'var(--color-bg-secondary)',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, color: hasConnectionWarning ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
          Connection rule:
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={template.isStartNode}
            onChange={e => {
              updateNodeTemplate(editingTemplateId, { isStartNode: e.target.checked });
              if (e.target.checked) setAllowedPreviousNodes(editingTemplateId, []);
            }}
          />
          Start node
        </label>
        {!template.isStartNode && otherTemplates.length > 0 && (
          <>
            <span style={{ color: 'var(--color-text-muted)' }}>Follows:</span>
            {otherTemplates.map(t => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={template.allowedPreviousNodes.includes(t.id)}
                  onChange={e => {
                    const newIds = e.target.checked
                      ? [...template.allowedPreviousNodes, t.id]
                      : template.allowedPreviousNodes.filter(id => id !== t.id);
                    setAllowedPreviousNodes(editingTemplateId, newIds);
                  }}
                />
                {t.name}
              </label>
            ))}
          </>
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
          onCellDoubleClicked={onCellDoubleClicked}
          onGridReady={e => { gridApiRef.current = e.api; }}
          rowSelection={{ mode: 'multiRow', enableClickSelection: true }}
          animateRows={false}
          undoRedoCellEditing={false}
          stopEditingWhenCellsLoseFocus={true}
          tooltipShowDelay={500}
        />
      </div>

      <DistanceEditDialog
        open={reconEditCell !== null}
        currentValue={reconEditCell?.value ?? 0}
        onClose={() => setReconEditCell(null)}
        onConfirm={(val) => {
          if (reconEditCell) {
            pushUndo(`Edit ${reconEditCell.field}`);
            const { field, index } = reconEditCell;
            if (field === 'rallyDistance') {
              updateRow(index, { rallyDistance: val, distanceHistory: [], distanceOverride: true });
            } else if (field === 'lat') {
              updateRow(index, { lat: val, latHistory: [], coordOverride: true });
            } else if (field === 'long') {
              updateRow(index, { long: val, longHistory: [], coordOverride: true });
            }
          }
          setReconEditCell(null);
        }}
        {...(reconEditCell?.field === 'lat' ? {
          title: 'Edit Latitude',
          message: 'Setting this value manually will erase the recon measurement history for this row. Future recon runs will start fresh from the new value.',
          label: 'Latitude',
          step: 0.000001,
          decimals: 6,
        } : reconEditCell?.field === 'long' ? {
          title: 'Edit Longitude',
          message: 'Setting this value manually will erase the recon measurement history for this row. Future recon runs will start fresh from the new value.',
          label: 'Longitude',
          step: 0.000001,
          decimals: 6,
        } : {})}
      />

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
