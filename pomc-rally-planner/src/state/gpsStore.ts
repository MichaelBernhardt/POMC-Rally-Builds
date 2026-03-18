import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface PortInfo {
  name: string;
  description: string;
}

export interface GpsData {
  connected: boolean;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  speed_knots: number | null;
  speed_kmh: number | null;
  heading: number | null;
  utc_time: string | null;
  utc_date: string | null;
  fix_quality: number;
  fix_quality_label: string;
  fix_type: number;
  fix_type_label: string;
  satellites_used: number;
  hdop: number | null;
  vdop: number | null;
  pdop: number | null;
  satellites: SatelliteInfo[];
}

export interface SatelliteInfo {
  prn: number;
  elevation: number | null;
  azimuth: number | null;
  snr: number | null;
  constellation: string;
  used: boolean;
}

const DEFAULT_BAUD = 115200;
const MAX_NMEA_LINES = 200;

interface GpsState {
  // Connection
  ports: PortInfo[];
  selectedPort: string;
  connected: boolean;
  connecting: boolean;
  error: string | null;

  // Data
  gpsData: GpsData | null;
  nmeaLines: string[];
  updateRate: number; // measured Hz

  // Actions
  refreshPorts: () => Promise<void>;
  setSelectedPort: (port: string) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  clearNmea: () => void;
}

export const useGpsStore = create<GpsState>((set, get) => ({
  ports: [],
  selectedPort: '',
  connected: false,
  connecting: false,
  error: null,
  gpsData: null,
  nmeaLines: [],
  updateRate: 0,

  refreshPorts: async () => {
    const result = await invoke<PortInfo[]>('list_serial_ports');
    const { selectedPort } = get();
    set({ ports: result });
    if (result.length > 0 && !selectedPort) {
      const usbPort = result.find(p => p.name.includes('cu.usbserial'));
      set({ selectedPort: usbPort?.name ?? result[0].name });
    }
  },

  setSelectedPort: (port: string) => set({ selectedPort: port }),

  connect: async () => {
    const { selectedPort } = get();
    if (!selectedPort) return;
    set({ connecting: true, error: null });
    try {
      await invoke('connect_gps', { portName: selectedPort, baudRate: DEFAULT_BAUD });
      set({ connected: true });
    } catch (e: any) {
      set({ error: String(e) });
    } finally {
      set({ connecting: false });
    }
  },

  disconnect: async () => {
    await invoke('disconnect_gps');
    set({ connected: false, gpsData: null });
  },

  clearNmea: () => set({ nmeaLines: [] }),
}));

// App-level listener setup — call once from AppShell
let initialized = false;
const unlisteners: UnlistenFn[] = [];

export function initGpsListeners() {
  if (initialized) return;
  initialized = true;

  // Update rate measurement
  const updateTimestamps: number[] = [];

  listen<GpsData>('gps:update', event => {
    const now = performance.now();
    updateTimestamps.push(now);
    // Keep only timestamps from the last 2 seconds
    while (updateTimestamps.length > 0 && now - updateTimestamps[0] > 2000) {
      updateTimestamps.shift();
    }
    const rate = updateTimestamps.length > 1
      ? (updateTimestamps.length - 1) / ((now - updateTimestamps[0]) / 1000)
      : 0;

    useGpsStore.setState({
      gpsData: event.payload,
      connected: event.payload.connected,
      updateRate: Math.round(rate * 10) / 10,
    });
  }).then(u => unlisteners.push(u));

  listen<string>('gps:nmea', event => {
    const { nmeaLines } = useGpsStore.getState();
    useGpsStore.setState({
      nmeaLines: [...nmeaLines.slice(-(MAX_NMEA_LINES - 1)), event.payload],
    });
  }).then(u => unlisteners.push(u));

  listen<string>('gps:error', event => {
    useGpsStore.setState({
      error: event.payload,
      connected: false,
    });
  }).then(u => unlisteners.push(u));
}
