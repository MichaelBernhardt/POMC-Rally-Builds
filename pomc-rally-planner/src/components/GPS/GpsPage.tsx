import { useEffect } from 'react';
import { useGpsStore } from '../../state/gpsStore';
import GpsMap from './GpsMap';
import SkyPlot from './SkyPlot';
import SatelliteChart from './SatelliteChart';
import NmeaLog from './NmeaLog';

const DEFAULT_BAUD = 115200;

function hdopQuality(hdop: number | null): { label: string; color: string } {
  if (hdop == null) return { label: '', color: 'var(--color-text-muted)' };
  if (hdop <= 1) return { label: 'Ideal', color: '#22C55E' };
  if (hdop <= 2) return { label: 'Excellent', color: '#22C55E' };
  if (hdop <= 5) return { label: 'Good', color: '#EAB308' };
  if (hdop <= 10) return { label: 'Moderate', color: '#F97316' };
  return { label: 'Poor', color: '#EF4444' };
}

export default function GpsPage() {
  const ports = useGpsStore(s => s.ports);
  const selectedPort = useGpsStore(s => s.selectedPort);
  const connected = useGpsStore(s => s.connected);
  const connecting = useGpsStore(s => s.connecting);
  const error = useGpsStore(s => s.error);
  const gpsData = useGpsStore(s => s.gpsData);
  const nmeaLines = useGpsStore(s => s.nmeaLines);

  const refreshPorts = useGpsStore(s => s.refreshPorts);
  const setSelectedPort = useGpsStore(s => s.setSelectedPort);
  const connect = useGpsStore(s => s.connect);
  const disconnect = useGpsStore(s => s.disconnect);
  const clearNmea = useGpsStore(s => s.clearNmea);

  // Refresh ports on first mount (only if not already loaded)
  useEffect(() => {
    if (ports.length === 0) {
      refreshPorts();
    }
  }, []);

  const fixColor = connected && gpsData && gpsData.fix_quality > 0 ? '#22C55E' : connected ? '#EAB308' : '#9CA3AF';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Connection bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        flexShrink: 0,
      }}>
        {/* Status dot */}
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: fixColor,
          boxShadow: connected ? `0 0 6px ${fixColor}` : 'none',
          flexShrink: 0,
        }} />

        <select
          value={selectedPort}
          onChange={e => setSelectedPort(e.target.value)}
          disabled={connected}
          style={{ minWidth: '220px', fontSize: '13px' }}
        >
          {ports.length === 0 && <option value="">No serial ports found</option>}
          {ports.map(p => (
            <option key={p.name} value={p.name}>
              {p.name}{p.description ? ` — ${p.description}` : ''}
            </option>
          ))}
        </select>

        <button
          onClick={refreshPorts}
          disabled={connected}
          title="Refresh port list"
          style={{ fontSize: '13px', padding: '4px 8px', minHeight: 'auto' }}
        >
          Refresh
        </button>

        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{DEFAULT_BAUD} baud</span>

        {!connected ? (
          <button
            className="primary"
            onClick={connect}
            disabled={connecting || !selectedPort}
            style={{ fontSize: '13px', padding: '4px 12px', minHeight: 'auto' }}
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        ) : (
          <button
            onClick={disconnect}
            style={{ fontSize: '13px', padding: '4px 12px', minHeight: 'auto' }}
          >
            Disconnect
          </button>
        )}

        {error && (
          <span style={{ color: '#EF4444', fontSize: '12px', marginLeft: '8px' }}>{error}</span>
        )}
      </div>

      {/* Main content grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '360px 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '0',
        overflow: 'hidden',
      }}>
        {/* Left top: Position + Accuracy */}
        <div style={{
          borderRight: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          overflow: 'auto',
          padding: '12px 16px',
        }}>
          <SectionTitle>Position</SectionTitle>
          <DataRow label="Latitude" value={gpsData?.latitude != null ? gpsData.latitude.toFixed(7) + '°' : '—'} />
          <DataRow label="Longitude" value={gpsData?.longitude != null ? gpsData.longitude.toFixed(7) + '°' : '—'} />
          <DataRow label="Altitude" value={gpsData?.altitude != null ? gpsData.altitude.toFixed(1) + ' m' : '—'} />
          <DataRow label="Speed" value={
            gpsData?.speed_kmh != null
              ? `${gpsData.speed_kmh.toFixed(1)} km/h (${gpsData.speed_knots?.toFixed(1)} kn)`
              : '—'
          } />
          <DataRow label="Heading" value={gpsData?.heading != null ? gpsData.heading.toFixed(1) + '°' : '—'} />
          <DataRow label="UTC Time" value={gpsData?.utc_time ?? '—'} />
          <DataRow label="UTC Date" value={gpsData?.utc_date ?? '—'} />

          <div style={{ marginTop: '12px' }} />
          <SectionTitle>Accuracy</SectionTitle>
          <DataRow label="Fix Quality" value={gpsData?.fix_quality_label ?? '—'} />
          <DataRow label="Fix Type" value={gpsData?.fix_type_label ?? '—'} />
          <DataRow label="Satellites" value={String(gpsData?.satellites_used ?? 0)} />
          <DataRow label="HDOP" value={
            gpsData?.hdop != null
              ? `${gpsData.hdop.toFixed(1)} (${hdopQuality(gpsData.hdop).label})`
              : '—'
          } valueColor={hdopQuality(gpsData?.hdop ?? null).color} />
          <DataRow label="VDOP" value={gpsData?.vdop != null ? gpsData.vdop.toFixed(1) : '—'} />
          <DataRow label="PDOP" value={gpsData?.pdop != null ? gpsData.pdop.toFixed(1) : '—'} />
        </div>

        {/* Right top: Map */}
        <div style={{
          borderBottom: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          <GpsMap
            latitude={gpsData?.latitude ?? null}
            longitude={gpsData?.longitude ?? null}
          />
        </div>

        {/* Left bottom: Sky plot + SNR chart */}
        <div style={{
          borderRight: '1px solid var(--color-border)',
          overflow: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <SectionTitle>Sky Plot</SectionTitle>
          <SkyPlot satellites={gpsData?.satellites ?? []} />
          <SectionTitle>Signal Strength</SectionTitle>
          <SatelliteChart satellites={gpsData?.satellites ?? []} />
        </div>

        {/* Right bottom: NMEA log */}
        <div style={{ overflow: 'hidden' }}>
          <NmeaLog lines={nmeaLines} onClear={clearNmea} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: 'var(--color-text-muted)',
      marginBottom: '6px',
    }}>
      {children}
    </div>
  );
}

function DataRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '2px 0',
      fontSize: '13px',
    }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: valueColor }}>{value}</span>
    </div>
  );
}
