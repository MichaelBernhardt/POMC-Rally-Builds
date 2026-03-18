import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons for Vite bundler
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface GpsMapProps {
  latitude: number | null;
  longitude: number | null;
}

function MapUpdater({ latitude, longitude, follow }: { latitude: number | null; longitude: number | null; follow: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (follow && latitude != null && longitude != null) {
      map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 0.5 });
    }
  }, [latitude, longitude, follow, map]);

  return null;
}

export default function GpsMap({ latitude, longitude }: GpsMapProps) {
  const [follow, setFollow] = useState(true);
  const hasPosition = latitude != null && longitude != null;

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={hasPosition ? [latitude!, longitude!] : [20, 0]}
        zoom={hasPosition ? 15 : 2}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasPosition && (
          <Marker position={[latitude!, longitude!]} />
        )}
        <MapUpdater latitude={latitude} longitude={longitude} follow={follow} />
      </MapContainer>

      {/* Follow toggle */}
      <button
        onClick={() => setFollow(f => !f)}
        title={follow ? 'Stop following GPS' : 'Follow GPS position'}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          background: follow ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
          color: follow ? '#fff' : 'var(--color-text)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          padding: '4px 8px',
          fontSize: '12px',
          cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      >
        {follow ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}
