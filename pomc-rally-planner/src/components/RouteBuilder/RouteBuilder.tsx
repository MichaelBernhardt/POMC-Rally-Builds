import { useState, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  CellEditingStoppedEvent,
  GetRowIdParams,
  RowClassRules,
  themeAlpine,
} from 'ag-grid-community';
import { getColumnDefs } from '../Grid/GridColumns';
import { flattenDayRows } from '../../state/storeHelpers';
import { RouteRow } from '../../types/domain';
import { useProjectStore, selectCurrentRally, selectCurrentDay, selectIsCurrentRallyLocked, selectReconMode, selectReconTolerance } from '../../state/projectStore';
import { validateNodeConnections } from '../../engine/validator';
import NodePalette from './NodePalette';
import ExportDialog from '../Dialogs/ExportDialog';
import '../../styles/grid-theme.css';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function RouteBuilder() {
  const rally = useProjectStore(selectCurrentRally);
  const day = useProjectStore(selectCurrentDay);
  const removeRouteNode = useProjectStore(s => s.removeRouteNode);
  const renameRouteNode = useProjectStore(s => s.renameRouteNode);
  const isLocked = useProjectStore(selectIsCurrentRallyLocked);
  const updateRow = useProjectStore(s => s.updateRow);
  const pushUndo = useProjectStore(s => s.pushUndo);
  const recalculateTimes = useProjectStore(s => s.recalculateTimes);
  const reconMode = useProjectStore(selectReconMode);
  const reconTolerance = useProjectStore(selectReconTolerance);
  const toggleReconMode = useProjectStore(s => s.toggleReconMode);
  const tab = useProjectStore(s => s.routeBuilderTab);
  const setTab = useProjectStore(s => s.setRouteBuilderTab);
  const [showExport, setShowExport] = useState(false);

  const columnDefs = useMemo(() => getColumnDefs({ reconMode, tolerance: reconTolerance }), [reconMode, reconTolerance]);
  const getRowId = useCallback((params: GetRowIdParams<RouteRow>) => params.data.id, []);

  const rowClassRules = useMemo<RowClassRules<RouteRow>>(() => ({
    'row-type-export': (params) => {
      const t = params.data?.type;
      return t !== null && t !== undefined && t !== 'm' && t !== 't';
    },
    'row-type-control': (params) => params.data?.type === 'm',
    'row-type-timeadd': (params) => params.data?.type === 't',
  }), []);

  const theme = useMemo(() => themeAlpine.withParams({
    fontSize: 15,
    headerFontSize: 16,
    foregroundColor: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    headerBackgroundColor: '#E8E8E8',
    oddRowBackgroundColor: '#FAFAFA',
    rowHoverColor: '#F0F4FF',
    selectedRowBackgroundColor: '#DBEAFE',
    borderColor: '#D0D0D0',
    cellHorizontalPadding: 10,
    rowHeight: 36,
    headerHeight: 42,
  }), []);

  const defaultColDef = useMemo(() => ({
    sortable: false,
    filter: false,
    resizable: true,
    suppressMovable: false,
    editable: !isLocked,
  }), [isLocked]);

  const onCellEditingStopped = useCallback((event: CellEditingStoppedEvent<RouteRow>) => {
    if (!event.data || event.rowIndex === null || event.rowIndex === undefined) return;

    const field = event.colDef.field as keyof RouteRow | undefined;
    if (!field) return;

    let newVal = event.newValue;
    let oldVal = event.oldValue;

    // Normalize type-code fields: treat '', undefined as null
    if (field === 'type' || field === 'suggestedType') {
      if (newVal === '' || newVal === undefined) newVal = null;
      if (oldVal === '' || oldVal === undefined) oldVal = null;
    }

    // Normalize optional number fields: treat '', undefined as null
    const optionalNumFields = ['bbPage', 'bbPage2', 'suggestedASpeed', 'instructionNumber', 'checkDist'];
    if (optionalNumFields.includes(field)) {
      if (newVal === '' || newVal === undefined) newVal = null;
      if (oldVal === '' || oldVal === undefined) oldVal = null;
      if (newVal !== null) newVal = parseFloat(newVal);
      if (oldVal !== null) oldVal = parseFloat(oldVal);
    }

    // Normalize required number fields: parse to number, default 0
    const requiredNumFields = [
      'rallyDistance', 'aSpeed', 'bSpeed', 'cSpeed', 'dSpeed',
      'speedLimit', 'lat', 'long',
      'addTimeA', 'addTimeB', 'addTimeC', 'addTimeD',
    ];
    if (requiredNumFields.includes(field)) {
      newVal = parseFloat(newVal) || 0;
      oldVal = parseFloat(oldVal) || 0;
    }

    // Skip if no actual change
    if (oldVal === newVal) return;

    pushUndo('Edit cell');
    updateRow(event.rowIndex, { [field]: newVal });
  }, [updateRow, pushUndo]);

  if (!rally || !day) {
    return (
      <div style={{ padding: '24px', color: 'var(--color-text-muted)', fontSize: '15px' }}>
        Select a day to build its route.
      </div>
    );
  }

  const nodes = day.nodes;
  const connectionErrors = validateNodeConnections(nodes, rally.nodeLibrary);
  const rowData = tab === 'table' ? flattenDayRows(day) : [];

  const segmentStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 14px',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    border: 'none',
    borderRadius: '4px',
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    cursor: 'pointer',
    minHeight: 'auto',
    boxShadow: 'none',
    lineHeight: '20px',
  });

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Main route area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 20px 0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Route Builder: <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>{rally.name}</span> {day.name}
              </h2>
              <div style={{
                display: 'inline-flex',
                background: 'var(--color-bg-secondary)',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid var(--color-border)',
              }}>
                <button style={segmentStyle(tab === 'nodes')} onClick={() => setTab('nodes')}>Nodes</button>
                <button style={segmentStyle(tab === 'table')} onClick={() => setTab('table')}>Table</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {tab === 'table' && (
                <>
                  <button
                    onClick={recalculateTimes}
                    disabled={isLocked}
                    className="primary"
                    style={{ padding: '4px 14px', fontSize: '13px', minHeight: 'auto' }}
                  >
                    Recalc Times
                  </button>
                  <button
                    onClick={toggleReconMode}
                    className={reconMode ? 'primary' : undefined}
                    style={{ padding: '4px 14px', fontSize: '13px', minHeight: 'auto' }}
                  >
                    Recon Mode
                  </button>
                  <button
                    onClick={() => setShowExport(true)}
                    style={{ padding: '4px 14px', fontSize: '13px', minHeight: 'auto' }}
                  >
                    Export CSV
                  </button>
                </>
              )}
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
              </span>
            </div>
          </div>
        </div>

        {tab === 'nodes' ? (
          <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px 20px' }}>
            {nodes.length === 0 ? (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                border: '2px dashed var(--color-border)',
                borderRadius: '8px',
                fontSize: '15px',
              }}>
                No nodes yet. Place a template from the palette on the right.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {nodes.map((node, index) => {
                  const connectionError = connectionErrors.find(e => e.nodeIndex === index);
                  const firstDist = node.rows.length > 0 ? node.rows[0].rallyDistance : 0;
                  const lastDist = node.rows.length > 0 ? node.rows[node.rows.length - 1].rallyDistance : 0;

                  return (
                    <div key={node.id}>
                      {/* Connection indicator */}
                      {index > 0 && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px 0',
                          gap: '6px',
                        }}>
                          <div style={{
                            width: '2px',
                            height: '16px',
                            background: connectionError ? 'var(--color-warning)' : 'var(--color-border)',
                          }} />
                          {connectionError && (
                            <span style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 600 }}>
                              {connectionError.message}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Start node warning (index 0 only) */}
                      {index === 0 && connectionError && (
                        <div style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 600, marginBottom: '4px', textAlign: 'center' }}>
                          {connectionError.message}
                        </div>
                      )}

                      {/* Node card */}
                      <div
                        style={{
                          padding: '12px 16px',
                          border: `1px solid ${connectionError ? 'var(--color-warning)' : 'var(--color-border)'}`,
                          borderRadius: '8px',
                          background: 'var(--color-bg)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '2px' }}>
                            {isLocked ? node.name : (
                              <input
                                type="text"
                                value={node.name}
                                onChange={e => renameRouteNode(node.id, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                onDoubleClick={e => e.stopPropagation()}
                                style={{
                                  fontWeight: 600,
                                  fontSize: '15px',
                                  border: '1px solid transparent',
                                  borderRadius: '4px',
                                  padding: '1px 4px',
                                  background: 'transparent',
                                  width: '100%',
                                }}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-bg)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                              />
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {node.rows.length} rows
                            {node.rows.length > 0 && (
                              <> {' \u2022 '} {firstDist.toFixed(2)} - {lastDist.toFixed(2)} km</>
                            )}
                            {node.sourceNodeId && (
                              <> {' \u2022 '} from template</>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {!isLocked && index === nodes.length - 1 && (
                            <button
                              onClick={e => { e.stopPropagation(); removeRouteNode(node.id); }}
                              style={{ padding: '2px 8px', fontSize: '12px', color: 'var(--color-danger)' }}
                            >
                              Del
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, padding: '0 20px 20px 20px' }}>
            <AgGridReact<RouteRow>
              theme={theme}
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              getRowId={getRowId}
              rowClassRules={rowClassRules}
              onCellEditingStopped={onCellEditingStopped}
              animateRows={false}
              undoRedoCellEditing={false}
              stopEditingWhenCellsLoseFocus={true}
              tooltipShowDelay={500}
            />
          </div>
        )}
      </div>

      {/* Palette sidebar (nodes view only) */}
      {!isLocked && tab === 'nodes' && (
        <div style={{
          width: '240px',
          borderLeft: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
          overflow: 'auto',
        }}>
          <NodePalette />
        </div>
      )}

      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
    </div>
  );
}
