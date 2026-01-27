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
} from 'ag-grid-community';
import { getColumnDefs } from './GridColumns';
import { RouteRow } from '../../types/domain';
import { useProjectStore } from '../../state/projectStore';
import '../../styles/grid-theme.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface RouteGridProps {
  onGridReady?: (api: GridApi) => void;
}

export default function RouteGrid({ onGridReady }: RouteGridProps) {
  const gridRef = useRef<AgGridReact<RouteRow>>(null);
  const rows = useProjectStore(s => s.getCurrentRows());
  const updateRow = useProjectStore(s => s.updateRow);
  const pushUndo = useProjectStore(s => s.pushUndo);

  const columnDefs = useMemo(() => getColumnDefs(), []);

  const defaultColDef = useMemo(() => ({
    sortable: false,
    filter: false,
    resizable: true,
    suppressMovable: false,
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
    if (event.oldValue === event.newValue) return;

    const field = event.colDef.field as keyof RouteRow | undefined;
    if (!field) return;

    pushUndo('Edit cell');

    // Handle empty string for type codes -> null
    let value = event.newValue;
    if ((field === 'type' || field === 'suggestedType') && (value === '' || value === undefined)) {
      value = null;
    }

    updateRow(event.rowIndex, { [field]: value });
  }, [updateRow, pushUndo]);

  const handleGridReady = useCallback((event: GridReadyEvent) => {
    onGridReady?.(event.api);
  }, [onGridReady]);

  return (
    <div className="ag-theme-alpine" style={{ width: '100%', height: '100%' }}>
      <AgGridReact<RouteRow>
        ref={gridRef}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        rowClassRules={rowClassRules}
        onCellEditingStopped={onCellEditingStopped}
        onGridReady={handleGridReady}
        rowSelection="multiple"
        enableCellTextSelection={true}
        ensureDomOrder={true}
        animateRows={false}
        undoRedoCellEditing={false}
        stopEditingWhenCellsLoseFocus={true}
        singleClickEdit={true}
        tooltipShowDelay={500}
        headerHeight={42}
        rowHeight={36}
      />
    </div>
  );
}
