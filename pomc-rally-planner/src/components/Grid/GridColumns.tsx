import { ColDef, ValueFormatterParams, ValueParserParams } from 'ag-grid-community';
import { RouteRow, TYPE_CODES, TypeCode } from '../../types/domain';

function numberParser(params: ValueParserParams): number {
  const val = parseFloat(params.newValue);
  return isNaN(val) ? (params.oldValue ?? 0) : val;
}

function optionalNumberParser(params: ValueParserParams): number | null {
  if (params.newValue === '' || params.newValue === null || params.newValue === undefined) {
    return null;
  }
  const val = parseFloat(params.newValue);
  return isNaN(val) ? params.oldValue : val;
}

function numberFormatter(decimals: number) {
  return (params: ValueFormatterParams): string => {
    const val = params.value;
    if (val === null || val === undefined || val === '') return '';
    return Number(val).toFixed(decimals);
  };
}

function typeCodeFormatter(params: ValueFormatterParams): string {
  const val = params.value as TypeCode | null;
  if (!val) return '';
  return val;
}

export function getColumnDefs(): ColDef<RouteRow>[] {
  return [
    {
      headerName: '#',
      valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      width: 55,
      pinned: 'left',
      editable: false,
      sortable: false,
      filter: false,
      suppressMovable: true,
      cellStyle: { color: '#888', textAlign: 'center' },
    },
    {
      headerName: 'BB Pg',
      field: 'bbPage',
      width: 70,
      editable: true,
      valueParser: optionalNumberParser,
      headerTooltip: 'Blackbook page reference',
    },
    {
      headerName: 'Terrain',
      field: 'terrain',
      width: 85,
      editable: true,
      headerTooltip: 'Terrain type: F (flat), U (uphill), D (downhill), FU, etc.',
    },
    {
      headerName: 'Sugg. Typ',
      field: 'suggestedType',
      width: 90,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['', ...TYPE_CODES],
      },
      valueFormatter: typeCodeFormatter,
      headerTooltip: 'Suggested type from reconnaissance',
    },
    {
      headerName: 'Sugg. A Sp',
      field: 'suggestedASpeed',
      width: 95,
      editable: true,
      valueParser: optionalNumberParser,
      headerTooltip: 'Suggested A-speed from reconnaissance',
    },
    {
      headerName: 'Rally Dist',
      field: 'rallyDistance',
      width: 100,
      editable: true,
      valueParser: numberParser,
      valueFormatter: numberFormatter(2),
      headerTooltip: 'Cumulative rally distance (km)',
      cellStyle: { fontWeight: '600' },
    },
    {
      headerName: 'Typ',
      field: 'type',
      width: 70,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['', ...TYPE_CODES],
      },
      valueFormatter: typeCodeFormatter,
      headerTooltip: 'Type code. Only rows with a type are exported. o=Open, f=Flat, d=Down, u=Up, l=Limit, m=Control, t=TimeAdd',
      cellClassRules: {
        'cell-type-o': (params) => params.value === 'o',
        'cell-type-f': (params) => params.value === 'f',
        'cell-type-d': (params) => params.value === 'd',
        'cell-type-u': (params) => params.value === 'u',
        'cell-type-l': (params) => params.value === 'l',
        'cell-type-m': (params) => params.value === 'm',
        'cell-type-t': (params) => params.value === 't',
      },
      cellStyle: { textAlign: 'center', fontWeight: 700, fontSize: '16px' },
    },
    {
      headerName: 'A Sp',
      field: 'aSpeed',
      width: 70,
      editable: true,
      valueParser: numberParser,
      headerTooltip: 'Speed group A (km/h)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'B Sp',
      field: 'bSpeed',
      width: 70,
      editable: true,
      valueParser: numberParser,
      headerTooltip: 'Speed group B (km/h)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'C Sp',
      field: 'cSpeed',
      width: 70,
      editable: true,
      valueParser: numberParser,
      headerTooltip: 'Speed group C (km/h)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'D Sp',
      field: 'dSpeed',
      width: 70,
      editable: true,
      valueParser: numberParser,
      headerTooltip: 'Speed group D (km/h)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'Limit',
      field: 'speedLimit',
      width: 70,
      editable: true,
      valueParser: numberParser,
      headerTooltip: 'Road speed limit (km/h)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'Instruction',
      field: 'clue',
      minWidth: 250,
      flex: 1,
      editable: true,
      headerTooltip: 'Route instruction text. {Curly braces} contain annotations stripped on clean export.',
    },
    {
      headerName: 'Lat',
      field: 'lat',
      width: 100,
      editable: true,
      valueParser: numberParser,
      valueFormatter: numberFormatter(5),
      headerTooltip: 'GPS Latitude (for marked controls)',
      cellStyle: { textAlign: 'right', fontSize: '13px' },
    },
    {
      headerName: 'Long',
      field: 'long',
      width: 100,
      editable: true,
      valueParser: numberParser,
      valueFormatter: numberFormatter(5),
      headerTooltip: 'GPS Longitude (for marked controls)',
      cellStyle: { textAlign: 'right', fontSize: '13px' },
    },
    {
      headerName: 'Add A',
      field: 'addTimeA',
      width: 70,
      editable: true,
      valueParser: numberParser,
      headerTooltip: 'Added time for group A (minutes, type "t" only)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'Add B',
      field: 'addTimeB',
      width: 70,
      editable: true,
      valueParser: numberParser,
      headerTooltip: 'Added time for group B (minutes)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'Add C',
      field: 'addTimeC',
      width: 70,
      editable: true,
      valueParser: numberParser,
      headerTooltip: 'Added time for group C (minutes)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'Add D',
      field: 'addTimeD',
      width: 70,
      editable: true,
      valueParser: numberParser,
      headerTooltip: 'Added time for group D (minutes)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'First Car',
      field: 'firstCarTime',
      width: 100,
      editable: false,
      headerTooltip: 'Computed: first car arrival time (HH:MM:SS)',
      cellStyle: { color: '#2563EB', fontWeight: 600 },
    },
    {
      headerName: 'Last Car',
      field: 'lastCarTime',
      width: 100,
      editable: false,
      headerTooltip: 'Computed: last car arrival time (HH:MM:SS)',
      cellStyle: { color: '#DC2626', fontWeight: 600 },
    },
  ];
}
