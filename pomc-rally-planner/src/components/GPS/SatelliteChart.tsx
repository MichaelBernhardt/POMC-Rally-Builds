interface SatelliteInfo {
  prn: number;
  snr: number | null;
  constellation: string;
  used: boolean;
}

interface SatelliteChartProps {
  satellites: SatelliteInfo[];
}

const CONSTELLATIONS = ['GPS', 'GLONASS', 'BeiDou', 'Galileo'];
const MAX_SNR = 50;
const BAR_WIDTH = 14;
const BAR_GAP = 2;
const CHART_HEIGHT = 120;
const LABEL_HEIGHT = 20;
const HEADER_HEIGHT = 18;

function snrColor(snr: number): string {
  if (snr > 30) return '#22C55E';
  if (snr > 20) return '#EAB308';
  return '#EF4444';
}

export default function SatelliteChart({ satellites }: SatelliteChartProps) {
  const groups = CONSTELLATIONS.map(name => ({
    name,
    sats: satellites.filter(s => s.constellation === name).sort((a, b) => a.prn - b.prn),
  })).filter(g => g.sats.length > 0);

  if (groups.length === 0) {
    return (
      <div style={{ color: 'var(--color-text-muted)', fontSize: '13px', padding: '16px', textAlign: 'center' }}>
        No satellites detected
      </div>
    );
  }

  const totalBars = groups.reduce((sum, g) => sum + g.sats.length, 0);
  const groupGap = 16;
  const totalWidth = totalBars * (BAR_WIDTH + BAR_GAP) + (groups.length - 1) * groupGap;

  let xOffset = 0;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${totalWidth + 20} ${CHART_HEIGHT + LABEL_HEIGHT + HEADER_HEIGHT + 10}`}
      style={{ maxHeight: '200px' }}
    >
      {/* Scale lines */}
      {[10, 20, 30, 40, 50].map(v => {
        const y = HEADER_HEIGHT + CHART_HEIGHT - (v / MAX_SNR) * CHART_HEIGHT;
        return (
          <g key={v}>
            <line x1={0} y1={y} x2={totalWidth + 20} y2={y} stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="2,2" />
            <text x={totalWidth + 14} y={y + 3} fontSize={8} fill="var(--color-text-muted)" textAnchor="end">{v}</text>
          </g>
        );
      })}

      {groups.map(group => {
        const groupX = xOffset;
        const elements = group.sats.map((sat, i) => {
          const x = xOffset + i * (BAR_WIDTH + BAR_GAP);
          const snr = sat.snr ?? 0;
          const barH = (snr / MAX_SNR) * CHART_HEIGHT;
          const y = HEADER_HEIGHT + CHART_HEIGHT - barH;
          const color = snrColor(snr);
          return (
            <g key={sat.prn}>
              <rect
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={barH}
                fill={color}
                opacity={sat.used ? 1 : 0.3}
                rx={1}
              />
              {snr > 0 && (
                <text x={x + BAR_WIDTH / 2} y={y - 2} textAnchor="middle" fontSize={8} fill="var(--color-text-muted)">
                  {snr}
                </text>
              )}
              <text
                x={x + BAR_WIDTH / 2}
                y={HEADER_HEIGHT + CHART_HEIGHT + LABEL_HEIGHT - 6}
                textAnchor="middle"
                fontSize={8}
                fill="var(--color-text-secondary)"
              >
                {sat.prn}
              </text>
            </g>
          );
        });

        const groupWidth = group.sats.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP;
        xOffset += groupWidth + groupGap;

        return (
          <g key={group.name}>
            <text
              x={groupX + groupWidth / 2}
              y={12}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill="var(--color-text-secondary)"
            >
              {group.name}
            </text>
            {elements}
          </g>
        );
      })}
    </svg>
  );
}
