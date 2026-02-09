import { useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  CellEditingStoppedEvent,
  GetRowIdParams,
  RowClassRules,
  GridReadyEvent,
  GridApi,
  themeAlpine,
} from 'ag-grid-community';
import { getColumnDefs } from './GridColumns';
import { RouteRow } from '../../types/domain';
import { useProjectStore, selectCurrentRows, selectCurrentDay, selectIsCurrentRallyLocked, selectReconMode, selectReconTolerance } from '../../state/projectStore';
import { flattenDayRows } from '../../state/storeHelpers';
import '../../styles/grid-theme.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface RouteGridProps {
  onGridReady?: (api: GridApi) => void;
}

export default function RouteGrid({ onGridReady }: RouteGridProps) {
  const gridRef = useRef<AgGridReact<RouteRow>>(null);
  const rows = useProjectStore(selectCurrentRows);
  const day = useProjectStore(selectCurrentDay);
  const isLocked = useProjectStore(selectIsCurrentRallyLocked);
  const reconMode = useProjectStore(selectReconMode);
  const reconTolerance = useProjectStore(selectReconTolerance);
  const updateRow = useProjectStore(s => s.updateRow);
  const pushUndo = useProjectStore(s => s.pushUndo);

  // Collect all unique clue values from the entire day for autocomplete
  const clueSuggestions = useMemo(() => {
    if (!day) return [];
    const clues = flattenDayRows(day).map(r => r.clue).filter(c => c && c.trim().length > 0);
    return [...new Set(clues)];
  }, [day]);

  const columnDefs = useMemo(() => getColumnDefs({ reconMode, tolerance: reconTolerance, clueSuggestions }), [reconMode, reconTolerance, clueSuggestions]);

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

    // Normalize boolean fields
    if (field === 'verified') {
      newVal = newVal === true;
      oldVal = oldVal === true;
    }

    // Skip if no actual change
    if (oldVal === newVal) return;

    pushUndo('Edit cell');
    updateRow(event.rowIndex, { [field]: newVal });
  }, [updateRow, pushUndo]);

  const handleGridReady = useCallback((event: GridReadyEvent) => {
    onGridReady?.(event.api);
  }, [onGridReady]);

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

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <AgGridReact<RouteRow>
        ref={gridRef}
        theme={theme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        rowClassRules={rowClassRules}
        onCellEditingStopped={onCellEditingStopped}
        onGridReady={handleGridReady}
        rowSelection="multiple"
        animateRows={false}
        undoRedoCellEditing={false}
        stopEditingWhenCellsLoseFocus={true}
        tooltipShowDelay={500}
        enterNavigatesVertically={true}
        enterNavigatesVerticallyAfterEdit={true}
      />
    </div>
  );
}
