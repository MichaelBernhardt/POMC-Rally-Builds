import { useRef, useEffect, useCallback } from 'react';

interface NmeaLogProps {
  lines: string[];
  onClear: () => void;
}

const SENTENCE_COLORS: Record<string, string> = {
  GGA: '#3B82F6',
  RMC: '#22C55E',
  GSA: '#A855F7',
  GSV: '#F97316',
  VTG: '#EAB308',
};

function colorForLine(line: string): string {
  for (const [type, color] of Object.entries(SENTENCE_COLORS)) {
    if (line.includes(type)) return color;
  }
  return 'var(--color-text-secondary)';
}

export default function NmeaLog({ lines, onClear }: NmeaLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    autoScrollRef.current = atBottom;
  }, []);

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          NMEA Log ({lines.length} lines)
        </span>
        <button
          onClick={onClear}
          style={{ fontSize: '11px', padding: '2px 8px', minHeight: 'auto' }}
        >
          Clear
        </button>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '11px',
          lineHeight: '16px',
          padding: '4px 8px',
          background: 'var(--color-bg)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ color: colorForLine(line), whiteSpace: 'nowrap' }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
