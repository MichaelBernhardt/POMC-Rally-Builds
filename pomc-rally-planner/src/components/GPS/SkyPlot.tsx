interface SatelliteInfo {
  prn: number;
  elevation: number | null;
  azimuth: number | null;
  snr: number | null;
  constellation: string;
  used: boolean;
}

interface SkyPlotProps {
  satellites: SatelliteInfo[];
}

const SIZE = 220;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = (SIZE - 40) / 2; // leave room for labels

const CONSTELLATION_COLORS: Record<string, string> = {
  GPS: '#3B82F6',
  GLONASS: '#EF4444',
  BeiDou: '#F97316',
  Galileo: '#22C55E',
};

function toXY(elevation: number, azimuth: number): { x: number; y: number } {
  // elevation 90° = center, 0° = edge
  const r = RADIUS * (1 - elevation / 90);
  const azRad = (azimuth - 90) * (Math.PI / 180); // -90 so 0° (N) points up
  return {
    x: CX + r * Math.cos(azRad),
    y: CY + r * Math.sin(azRad),
  };
}

export default function SkyPlot({ satellites }: SkyPlotProps) {
  const visible = satellites.filter(s => s.elevation != null && s.azimuth != null);

  return (
    <svg width="100%" viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ maxHeight: '220px' }}>
      {/* Background */}
      <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={1} />

      {/* Elevation rings: 30°, 60° */}
      <circle cx={CX} cy={CY} r={RADIUS * (2 / 3)} fill="none" stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="3,3" />
      <circle cx={CX} cy={CY} r={RADIUS * (1 / 3)} fill="none" stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="3,3" />

      {/* Elevation labels */}
      <text x={CX + 3} y={CY - RADIUS * (1 / 3) + 3} fontSize={7} fill="var(--color-text-muted)">60°</text>
      <text x={CX + 3} y={CY - RADIUS * (2 / 3) + 3} fontSize={7} fill="var(--color-text-muted)">30°</text>

      {/* Cross hairs — N/S and E/W */}
      <line x1={CX} y1={CY - RADIUS} x2={CX} y2={CY + RADIUS} stroke="var(--color-border)" strokeWidth={0.5} />
      <line x1={CX - RADIUS} y1={CY} x2={CX + RADIUS} y2={CY} stroke="var(--color-border)" strokeWidth={0.5} />

      {/* Cardinal labels */}
      <text x={CX} y={CY - RADIUS - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--color-text-secondary)">N</text>
      <text x={CX} y={CY + RADIUS + 12} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--color-text-secondary)">S</text>
      <text x={CX + RADIUS + 6} y={CY + 4} textAnchor="start" fontSize={10} fontWeight={600} fill="var(--color-text-secondary)">E</text>
      <text x={CX - RADIUS - 6} y={CY + 4} textAnchor="end" fontSize={10} fontWeight={600} fill="var(--color-text-secondary)">W</text>

      {/* Satellites */}
      {visible.map(sat => {
        const { x, y } = toXY(sat.elevation!, sat.azimuth!);
        const color = CONSTELLATION_COLORS[sat.constellation] ?? '#9CA3AF';
        return (
          <g key={`${sat.constellation}-${sat.prn}`}>
            <circle
              cx={x}
              cy={y}
              r={sat.used ? 5 : 4}
              fill={color}
              opacity={sat.used ? 1 : 0.35}
              stroke={sat.used ? '#fff' : 'none'}
              strokeWidth={sat.used ? 1 : 0}
            />
            <text
              x={x}
              y={y - 7}
              textAnchor="middle"
              fontSize={7}
              fontWeight={sat.used ? 600 : 400}
              fill={color}
              opacity={sat.used ? 1 : 0.6}
            >
              {sat.prn}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {Object.entries(CONSTELLATION_COLORS).map(([name, color], i) => (
        <g key={name} transform={`translate(${4 + i * 55}, ${SIZE - 6})`}>
          <circle cx={4} cy={-3} r={3} fill={color} />
          <text x={10} y={0} fontSize={7} fill="var(--color-text-muted)">{name}</text>
        </g>
      ))}
    </svg>
  );
}
