import { MutableRefObject } from 'react';
import { ColDef, ValueFormatterParams, ValueParserParams, ValueGetterParams, CellStyle, GridApi } from 'ag-grid-community';
import { RouteRow, TYPE_CODES, TypeCode } from '../../types/domain';
import AutocompleteCellEditor from './AutocompleteCellEditor';

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

function percentFormatter(decimals: number) {
  return (params: ValueFormatterParams): string => {
    const val = params.value;
    if (val === null || val === undefined || val === '') return '';
    return `${(Number(val) * 100).toFixed(decimals)}%`;
  };
}

function typeCodeFormatter(params: ValueFormatterParams): string {
  const val = params.value as TypeCode | null;
  if (!val) return '';
  return val;
}

interface ReconOptions {
  reconMode: boolean;
  tolerance: number;
  clueSuggestions?: string[];
  /** Ref-based suggestions that stay fresh without changing columnDefs */
  clueSuggestionsRef?: MutableRefObject<string[]>;
}

export function getColumnDefs(recon?: ReconOptions): ColDef<RouteRow>[] {
  const reconOn = recon?.reconMode ?? false;
  const tolerance = Math.max(0, recon?.tolerance ?? 0.01);
  const criticalTolerance = tolerance * 2;
  const epsilon = tolerance * 0.1;

  const getBaseDistances = (params: ValueGetterParams<RouteRow>) => {
    const first = params.api.getDisplayedRowAtIndex(0)?.data;
    if (!first) return null;
    const baseCheck = first.checkDist ?? 0;
    const baseRally = first.rallyDistance ?? 0;
    return { baseCheck, baseRally };
  };

  /** Estimate checkDist for a row based on drift from nearest previous row with checkDist */
  const getEstimatedCheckDist = (api: GridApi, data: RouteRow | undefined, rowIndex: number | null | undefined): number | null => {
    if (!data || rowIndex === null || rowIndex === undefined || rowIndex <= 0) return null;
    const first = api.getDisplayedRowAtIndex(0)?.data as RouteRow | undefined;
    if (!first) return null;
    const baseCheck = first.checkDist ?? 0;
    const baseRally = first.rallyDistance ?? 0;
    for (let i = rowIndex - 1; i >= 0; i--) {
      const prev = api.getDisplayedRowAtIndex(i)?.data as RouteRow | undefined;
      if (!prev || prev.checkDist == null) continue;
      const denom = prev.checkDist - baseCheck;
      if (denom === 0) return Math.round((baseCheck + (data.rallyDistance - baseRally)) * 100) / 100;
      const delta = (prev.checkDist - baseCheck) - (prev.rallyDistance - baseRally);
      const error = delta / denom;
      return Math.round((baseCheck + (data.rallyDistance - baseRally) * (1 + error)) * 100) / 100;
    }
    return null;
  };

  const getDelta = (params: ValueGetterParams<RouteRow>): number | null => {
    const base = getBaseDistances(params);
    const row = params.data;
    if (!base || !row) return null;
    if (row.checkDist === null || row.checkDist === undefined) return null;
    if (row.rallyDistance === null || row.rallyDistance === undefined) return null;
    return (row.checkDist - base.baseCheck) - (row.rallyDistance - base.baseRally);
  };

  const getError = (params: ValueGetterParams<RouteRow>): number | null => {
    const base = getBaseDistances(params);
    const row = params.data;
    if (!base || !row) return null;
    if (row.checkDist === null || row.checkDist === undefined) return null;
    if (row.rallyDistance === null || row.rallyDistance === undefined) return null;
    const denom = row.checkDist - base.baseCheck;
    if (denom === 0) return 0;
    const delta = (row.checkDist - base.baseCheck) - (row.rallyDistance - base.baseRally);
    return delta / denom;
  };

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
      headerName: 'V',
      field: 'verified',
      width: 40,
      pinned: 'left',
      hide: true, // Hidden in UI but data field preserved for backwards compatibility
      editable: true,
      headerTooltip: 'Verified during reconnaissance',
      cellRenderer: 'agCheckboxCellRenderer',
      cellRendererParams: {
        disabled: false,
      },
      valueGetter: (params) => params.data?.verified === true,
      valueSetter: (params) => {
        params.data.verified = params.newValue === true;
        return true;
      },
    },
    {
      headerName: 'BB Pg',
      field: 'bbPage',
      width: 70,
      valueParser: optionalNumberParser,
      headerTooltip: 'Blackbook page reference',
    },
    {
      headerName: 'Terrain',
      field: 'terrain',
      width: 85,
      headerTooltip: 'Terrain type: F (flat), U (uphill), D (downhill), FU, etc.',
    },
    {
      headerName: 'Sugg. Typ',
      field: 'suggestedType',
      width: 90,
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
      valueParser: optionalNumberParser,
      headerTooltip: 'Suggested A-speed from reconnaissance',
    },
    {
      headerName: 'Rally Dist',
      field: 'rallyDistance',
      width: 100,
      valueParser: numberParser,
      valueFormatter: numberFormatter(2),
      headerTooltip: 'Cumulative rally distance (km)',
      cellStyle: { fontWeight: '600' },
    },
    {
      headerName: 'Check Dist',
      field: 'checkDist',
      width: 100,
      hide: !reconOn,
      valueParser: optionalNumberParser,
      valueFormatter: (params: ValueFormatterParams<RouteRow>): string => {
        if (params.value != null && params.value !== '') {
          return Number(params.value).toFixed(2);
        }
        if (!reconOn) return '';
        const suggestion = getEstimatedCheckDist(params.api, params.data, params.node?.rowIndex);
        if (suggestion == null) return '';
        return suggestion.toFixed(2);
      },
      cellEditorParams: { useFormatter: true },
      headerTooltip: 'Measured distance during reconnaissance (km). Grey values are estimates — press Enter to accept.',
      cellStyle: (params): CellStyle => {
        const base: CellStyle = { textAlign: 'right' };
        if (params.data?.checkDist == null && reconOn) {
          return { ...base, color: '#9CA3AF', fontStyle: 'italic' };
        }
        return base;
      },
    },
    {
      headerName: 'Δ',
      valueGetter: getDelta,
      width: 80,
      hide: !reconOn,
      editable: false,
      valueFormatter: numberFormatter(2),
      headerTooltip: 'Delta between checked and planned distance (km)',
      cellStyle: (params): CellStyle => {
        const base: CellStyle = { textAlign: 'right' };
        if (!reconOn) return base;
        const delta = params.value;
        if (delta === null || delta === undefined || delta === '') return base;
        const absDelta = Math.abs(Number(delta));
        if (absDelta > criticalTolerance) {
          return { ...base, backgroundColor: '#FFC7CE' };
        }
        if (absDelta >= tolerance && absDelta <= criticalTolerance + epsilon) {
          return { ...base, backgroundColor: '#FFEB9C' };
        }
        if (absDelta <= tolerance + epsilon) {
          return { ...base, backgroundColor: '#C6EFCE' };
        }
        return base;
      },
    },
    {
      headerName: 'Err %',
      valueGetter: getError,
      width: 80,
      hide: !reconOn,
      editable: false,
      valueFormatter: percentFormatter(1),
      headerTooltip: 'Percent error vs planned distance',
      cellStyle: (params): CellStyle => {
        const base: CellStyle = { textAlign: 'right' };
        if (!reconOn) return base;
        const err = params.value;
        if (err === null || err === undefined || err === '') return base;
        const val = Number(err);
        if (val > 0.01 || val < -0.01) {
          return { ...base, backgroundColor: '#FFC7CE' };
        }
        return base;
      },
    },
    {
      headerName: 'Typ',
      field: 'type',
      width: 70,
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
      valueParser: numberParser,
      headerTooltip: 'Speed group A (km/h)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'B Sp',
      field: 'bSpeed',
      width: 70,
      valueParser: numberParser,
      headerTooltip: 'Speed group B (km/h)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'C Sp',
      field: 'cSpeed',
      width: 70,
      valueParser: numberParser,
      headerTooltip: 'Speed group C (km/h)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'D Sp',
      field: 'dSpeed',
      width: 70,
      valueParser: numberParser,
      headerTooltip: 'Speed group D (km/h)',
      cellStyle: (params): CellStyle => {
        const base: CellStyle = { textAlign: 'right' };
        const dSpeed = params.data?.dSpeed;
        const speedLimit = params.data?.speedLimit;
        if (dSpeed != null && speedLimit != null && speedLimit > 0 && dSpeed > 0.9 * speedLimit) {
          return { ...base, backgroundColor: '#FF9999' };
        }
        return base;
      },
    },
    {
      headerName: 'Limit',
      field: 'speedLimit',
      width: 70,
      valueParser: numberParser,
      headerTooltip: 'Road speed limit (km/h)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'Instruction',
      field: 'clue',
      minWidth: 250,
      flex: 1,
      wrapText: true,
      autoHeight: true,
      headerTooltip: 'Route instruction text. {Curly braces} contain annotations stripped on clean export.',
      cellStyle: { lineHeight: '1.4', paddingTop: '8px', paddingBottom: '8px' },
      cellEditor: AutocompleteCellEditor,
      cellEditorParams: recon?.clueSuggestionsRef
        ? () => ({ suggestions: recon.clueSuggestionsRef!.current })
        : { suggestions: recon?.clueSuggestions ?? [] },
    },
    {
      headerName: 'Lat',
      field: 'lat',
      width: 110,
      valueParser: numberParser,
      valueFormatter: numberFormatter(6),
      headerTooltip: 'GPS Latitude (for marked controls)',
      cellStyle: { textAlign: 'right', fontSize: '13px' },
    },
    {
      headerName: 'Check Lat',
      field: 'checkLat',
      width: 110,
      hide: !reconOn,
      valueParser: optionalNumberParser,
      valueFormatter: numberFormatter(6),
      headerTooltip: 'Recon GPS Latitude. Green: within ~111m, Yellow: ~111–555m, Red: >555m from template average.',
      cellStyle: (params): CellStyle => {
        const base: CellStyle = { textAlign: 'right', fontSize: '13px' };
        if (!reconOn || params.data?.checkLat == null) return base;
        const templateLat = params.data?.latHistory;
        if (!templateLat || templateLat.length === 0) return base;
        const avg = templateLat.slice(-3).reduce((s: number, e: { value: number }) => s + e.value, 0) / Math.min(templateLat.length, 3);
        const deviation = Math.abs(params.data.checkLat - avg);
        if (deviation > 0.005) return { ...base, backgroundColor: '#FFC7CE' };
        if (deviation > 0.001) return { ...base, backgroundColor: '#FFEB9C' };
        return { ...base, backgroundColor: '#C6EFCE' };
      },
    },
    {
      headerName: 'Long',
      field: 'long',
      width: 110,
      valueParser: numberParser,
      valueFormatter: numberFormatter(6),
      headerTooltip: 'GPS Longitude (for marked controls)',
      cellStyle: { textAlign: 'right', fontSize: '13px' },
    },
    {
      headerName: 'Check Long',
      field: 'checkLong',
      width: 110,
      hide: !reconOn,
      valueParser: optionalNumberParser,
      valueFormatter: numberFormatter(6),
      headerTooltip: 'Recon GPS Longitude. Green: within ~111m, Yellow: ~111–555m, Red: >555m from template average.',
      cellStyle: (params): CellStyle => {
        const base: CellStyle = { textAlign: 'right', fontSize: '13px' };
        if (!reconOn || params.data?.checkLong == null) return base;
        const templateLong = params.data?.longHistory;
        if (!templateLong || templateLong.length === 0) return base;
        const avg = templateLong.slice(-3).reduce((s: number, e: { value: number }) => s + e.value, 0) / Math.min(templateLong.length, 3);
        const deviation = Math.abs(params.data.checkLong - avg);
        if (deviation > 0.005) return { ...base, backgroundColor: '#FFC7CE' };
        if (deviation > 0.001) return { ...base, backgroundColor: '#FFEB9C' };
        return { ...base, backgroundColor: '#C6EFCE' };
      },
    },
    {
      headerName: 'Add A',
      field: 'addTimeA',
      width: 70,
      valueParser: numberParser,
      headerTooltip: 'Added time for group A (minutes, type "t" only)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'Add B',
      field: 'addTimeB',
      width: 70,
      valueParser: numberParser,
      headerTooltip: 'Added time for group B (minutes)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'Add C',
      field: 'addTimeC',
      width: 70,
      valueParser: numberParser,
      headerTooltip: 'Added time for group C (minutes)',
      cellStyle: { textAlign: 'right' },
    },
    {
      headerName: 'Add D',
      field: 'addTimeD',
      width: 70,
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
