import { useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  CellEditingStoppedEvent,
  GetRowIdParams,
  RowClassRules,
  GridReadyEvent,
  themeAlpine,
} from 'ag-grid-community';
import { getColumnDefs } from '../Grid/GridColumns';
import { RouteRow } from '../../types/domain';
import { useProjectStore } from '../../state/projectStore';
import { validateTemplate } from '../../engine/validator';
import '../../styles/grid-theme.css';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function NodeTemplateEditor() {
  const gridRef = useRef<AgGridReact<RouteRow>>(null);
  const editingTemplateId = useProjectStore(s => s.editingTemplateId);
  const getCurrentRally = useProjectStore(s => s.getCurrentRally);
  const updateNodeTemplate = useProjectStore(s => s.updateNodeTemplate);
  const setAllowedPreviousNodes = useProjectStore(s => s.setAllowedPreviousNodes);
  const setEditingTemplate = useProjectStore(s => s.setEditingTemplate);
  const rows = useProjectStore(s => s.getCurrentRows());
  const isLocked = useProjectStore(s => s.isCurrentRallyLocked());
  const updateRow = useProjectStore(s => s.updateRow);
  const pushUndo = useProjectStore(s => s.pushUndo);
  const addRow = useProjectStore(s => s.addRow);
  const deleteRows = useProjectStore(s => s.deleteRows);

  const rally = getCurrentRally();
  const template = rally?.nodeLibrary.find(t => t.id === editingTemplateId);

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

    const optionalNumFields = ['bbPage', 'bbPage2', 'suggestedASpeed', 'instructionNumber'];
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
          rowSelection="multiple"
          animateRows={false}
          undoRedoCellEditing={false}
          stopEditingWhenCellsLoseFocus={true}
          tooltipShowDelay={500}
        />
      </div>
    </div>
  );
}
