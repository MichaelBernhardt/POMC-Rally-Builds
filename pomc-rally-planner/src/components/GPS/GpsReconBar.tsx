import { useEffect, useCallback, useState, useRef } from 'react';
import { GridApi } from 'ag-grid-community';
import { useGpsStore } from '../../state/gpsStore';
import { useProjectStore, selectReconMode } from '../../state/projectStore';

interface GpsReconBarProps {
  gridApi: GridApi | null;
}

function hdopLabel(hdop: number): string {
  if (hdop <= 1) return 'Ideal';
  if (hdop <= 2) return 'Excellent';
  if (hdop <= 5) return 'Good';
  if (hdop <= 10) return 'Moderate';
  return 'Poor';
}

export default function GpsReconBar({ gridApi }: GpsReconBarProps) {
  const reconMode = useProjectStore(selectReconMode);
  const viewMode = useProjectStore(s => s.viewMode);
  const connected = useGpsStore(s => s.connected);
  const gpsData = useGpsStore(s => s.gpsData);
  const odoKm = useGpsStore(s => s.odoKm);
  const odoActive = useGpsStore(s => s.odoActive);
  const resetOdo = useGpsStore(s => s.resetOdo);
  const setOdoKm = useGpsStore(s => s.setOdoKm);
  const setOdoActive = useGpsStore(s => s.setOdoActive);

  const [editingOdo, setEditingOdo] = useState(false);
  const [odoInput, setOdoInput] = useState('');
  const odoInputRef = useRef<HTMLInputElement>(null);
  const captureReconPoint = useProjectStore(s => s.captureReconPoint);

  // Sync odoActive with reconMode && connected
  useEffect(() => {
    const shouldBeActive = reconMode && connected;
    if (shouldBeActive !== odoActive) {
      setOdoActive(shouldBeActive);
    }
  }, [reconMode, connected, odoActive, setOdoActive]);

  const handleCapture = useCallback(() => {
    if (!gridApi) return;
    const selectedNodes = gridApi.getSelectedNodes();
    if (selectedNodes.length === 0) return;
    const selectedIndex = selectedNodes[0].rowIndex;
    if (selectedIndex == null) return;

    captureReconPoint(selectedIndex);

    // Auto-advance to next row
    const nextIndex = selectedIndex + 1;
    const nextNode = gridApi.getDisplayedRowAtIndex(nextIndex);
    if (nextNode) {
      nextNode.setSelected(true, true);
      gridApi.ensureIndexVisible(nextIndex);
    }
  }, [gridApi, captureReconPoint]);

  if (!reconMode || !connected || viewMode !== 'routeBuilder') return null;

  const hasFix = gpsData != null && gpsData.fix_quality >= 1;
  const lat = gpsData?.latitude;
  const lon = gpsData?.longitude;
  const speed = gpsData?.speed_kmh;
  const hdop = gpsData?.hdop;

  let hasSelection = false;
  try {
    hasSelection = gridApi != null && gridApi.getSelectedNodes().length > 0;
  } catch {
    // Grid API may be destroyed when switching views
  }

  const hdopColor = hdop == null ? undefined
    : hdop <= 2 ? 'var(--color-success)'
    : hdop <= 5 ? 'var(--color-warning)'
    : 'var(--color-danger)';

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--color-text-muted)',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'ui-monospace, "SF Mono", Monaco, monospace',
    color: 'var(--color-text)',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      padding: '5px 10px',
      borderBottom: '1px solid var(--color-border)',
      background: 'linear-gradient(to bottom, var(--color-bg-secondary), var(--color-bg))',
      flexShrink: 0,
    }}>
      {/* Fix indicator */}
      <span style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: hasFix ? 'var(--color-success)' : 'var(--color-danger)',
        boxShadow: hasFix ? '0 0 6px var(--color-success)' : '0 0 6px var(--color-danger)',
        flexShrink: 0,
        marginRight: '8px',
      }} />

      {/* Position group */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={labelStyle}>Lat</span>
          <span style={valueStyle}>{lat != null ? lat.toFixed(7) + '°' : '---'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={labelStyle}>Long</span>
          <span style={valueStyle}>{lon != null ? lon.toFixed(7) + '°' : '---'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={labelStyle}>Speed</span>
          <span style={valueStyle}>{speed != null ? speed.toFixed(1) : '---'} <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>km/h</span></span>
        </div>
        {hdop != null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={labelStyle}>HDOP</span>
            <span style={{ ...valueStyle, color: hdopColor }}>{hdop.toFixed(1)} <span style={{ fontSize: '10px' }}>{hdopLabel(hdop)}</span></span>
          </div>
        )}
      </div>

      <div style={{ width: '1px', height: '28px', background: 'var(--color-border)', margin: '0 10px' }} />

      {/* Odometer group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={labelStyle}>Odometer</span>
          {editingOdo ? (
            <input
              ref={odoInputRef}
              type="number"
              value={odoInput}
              onChange={e => setOdoInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const parsed = parseFloat(odoInput);
                  if (!isNaN(parsed) && parsed >= 0) setOdoKm(parsed);
                  setEditingOdo(false);
                } else if (e.key === 'Escape') {
                  setEditingOdo(false);
                }
              }}
              onBlur={() => {
                const parsed = parseFloat(odoInput);
                if (!isNaN(parsed) && parsed >= 0) setOdoKm(parsed);
                setEditingOdo(false);
              }}
              min={0}
              step={0.001}
              style={{
                ...valueStyle,
                fontWeight: 700,
                fontSize: '14px',
                width: '90px',
                padding: '0 2px',
                border: '1px solid var(--color-accent)',
                borderRadius: '3px',
                background: 'var(--color-bg)',
                outline: 'none',
              }}
            />
          ) : (
            <span
              onClick={() => {
                setOdoInput(odoKm.toFixed(3));
                setEditingOdo(true);
                requestAnimationFrame(() => odoInputRef.current?.select());
              }}
              title="Click to set odometer value"
              style={{
                ...valueStyle,
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                borderBottom: '1px dashed var(--color-text-muted)',
              }}
            >
              {odoKm.toFixed(3)} <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--color-text-muted)' }}>km</span>
            </span>
          )}
        </div>
        <button
          onClick={resetOdo}
          title="Reset odometer"
          style={{
            padding: '3px 8px',
            fontSize: '11px',
            minHeight: 'auto',
            lineHeight: '1.2',
            borderRadius: '4px',
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* Capture button */}
      <button
        className="primary"
        disabled={!hasFix || !hasSelection}
        onClick={handleCapture}
        title={!hasSelection ? 'Select a row first' : !hasFix ? 'No GPS fix' : 'Capture GPS data to selected row'}
        style={{
          padding: '6px 18px',
          fontSize: '13px',
          fontWeight: 600,
          minHeight: 'auto',
          borderRadius: '6px',
          letterSpacing: '0.3px',
        }}
      >
        Capture
      </button>
    </div>
  );
}
