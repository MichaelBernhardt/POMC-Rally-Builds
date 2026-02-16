import { useEffect, useRef, useMemo } from 'react';
import { NodeTemplate } from '../../types/domain';
import { isTemplateComplete } from '../../engine/validator';

interface Props {
  templates: NodeTemplate[];
  onClose: () => void;
  activeRoute?: string[];  // sequence of template IDs from placed nodes
  title?: string;          // custom dialog title (default: "Route Connections")
}

// Layout constants
const NODE_W = 160;
const NODE_H = 56;
const COL_GAP = 100;
const ROW_GAP = 24;
const PAD_X = 40;
const PAD_Y = 40;

interface LayoutNode {
  id: string;
  name: string;
  isStart: boolean;
  incomplete: boolean;
  level: number;
  col: number; // same as level, used for x
  row: number; // vertical position within column
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
}

function buildLayout(templates: NodeTemplate[]) {
  const idMap = new Map(templates.map(t => [t.id, t]));

  // Build forward adjacency: A → B means B.allowedPreviousNodes includes A
  const forwardEdges: Edge[] = [];
  for (const t of templates) {
    for (const prevId of t.allowedPreviousNodes) {
      if (idMap.has(prevId)) {
        forwardEdges.push({ from: prevId, to: t.id });
      }
    }
  }

  // Assign levels via BFS from start nodes (level 0)
  const levels = new Map<string, number>();
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();

  for (const t of templates) {
    successors.set(t.id, []);
    predecessors.set(t.id, []);
  }
  for (const e of forwardEdges) {
    successors.get(e.from)!.push(e.to);
    predecessors.get(e.to)!.push(e.from);
  }

  // Start nodes get level 0
  const queue: string[] = [];
  for (const t of templates) {
    if (t.isStartNode) {
      levels.set(t.id, 0);
      queue.push(t.id);
    }
  }

  // BFS: each successor gets max(predecessor levels) + 1
  const maxVisits = templates.length;
  const visitCounts = new Map<string, number>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    const count = (visitCounts.get(id) ?? 0) + 1;
    visitCounts.set(id, count);
    if (count > maxVisits) continue; // cycle guard

    const myLevel = levels.get(id) ?? 0;
    for (const succId of successors.get(id) ?? []) {
      const newLevel = myLevel + 1;
      const oldLevel = levels.get(succId) ?? -1;
      if (newLevel > oldLevel) {
        levels.set(succId, newLevel);
        queue.push(succId);
      }
    }
  }

  // Orphan nodes (no level assigned) go in a rightmost column
  const maxLevel = Math.max(0, ...Array.from(levels.values()));
  const orphanLevel = levels.size < templates.length ? maxLevel + 1 : maxLevel;
  for (const t of templates) {
    if (!levels.has(t.id)) {
      levels.set(t.id, orphanLevel);
    }
  }

  // Group by level and assign row positions
  const columns = new Map<number, string[]>();
  for (const t of templates) {
    const lvl = levels.get(t.id)!;
    if (!columns.has(lvl)) columns.set(lvl, []);
    columns.get(lvl)!.push(t.id);
  }

  const layoutNodes: LayoutNode[] = [];
  for (const t of templates) {
    const lvl = levels.get(t.id)!;
    const colMembers = columns.get(lvl)!;
    const rowIdx = colMembers.indexOf(t.id);
    const x = PAD_X + lvl * (NODE_W + COL_GAP);
    const y = PAD_Y + rowIdx * (NODE_H + ROW_GAP);
    layoutNodes.push({
      id: t.id,
      name: t.name,
      isStart: t.isStartNode,
      incomplete: !isTemplateComplete(t),
      level: lvl,
      col: lvl,
      row: rowIdx,
      x,
      y,
    });
  }

  // Compute total SVG size
  const totalLevels = (columns.size > 0 ? Math.max(...columns.keys()) + 1 : 1);
  const maxPerCol = Math.max(1, ...Array.from(columns.values()).map(c => c.length));
  const svgW = PAD_X * 2 + totalLevels * NODE_W + (totalLevels - 1) * COL_GAP;
  const svgH = PAD_Y * 2 + maxPerCol * NODE_H + (maxPerCol - 1) * ROW_GAP;

  return { layoutNodes, edges: forwardEdges, svgW, svgH };
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
}

export default function ConnectionDiagram({ templates, onClose, activeRoute, title }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasRoute = activeRoute && activeRoute.length > 0;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const { layoutNodes, edges, svgW, svgH } = useMemo(
    () => buildLayout(templates),
    [templates],
  );

  const nodeMap = useMemo(
    () => new Map(layoutNodes.map(n => [n.id, n])),
    [layoutNodes],
  );

  // Compute active node/edge sets and step numbers from the route
  const { activeNodeIds, activeEdgeKeys, nodeSteps } = useMemo(() => {
    const nodeIds = new Set<string>();
    const edgeKeys = new Set<string>();
    const steps = new Map<string, number[]>();
    if (activeRoute) {
      for (let i = 0; i < activeRoute.length; i++) {
        const id = activeRoute[i];
        nodeIds.add(id);
        if (!steps.has(id)) steps.set(id, []);
        steps.get(id)!.push(i + 1);
        if (i > 0) {
          edgeKeys.add(`${activeRoute[i - 1]}->${id}`);
        }
      }
    }
    return { activeNodeIds: nodeIds, activeEdgeKeys: edgeKeys, nodeSteps: steps };
  }, [activeRoute]);

  // Compute Y offsets for multiple edges arriving at the same target
  const edgeOffsets = useMemo(() => {
    const targetGroups = new Map<string, Edge[]>();
    for (const e of edges) {
      if (!targetGroups.has(e.to)) targetGroups.set(e.to, []);
      targetGroups.get(e.to)!.push(e);
    }
    const offsets = new Map<string, number>();
    for (const [, group] of targetGroups) {
      const count = group.length;
      group.forEach((e, i) => {
        const offset = count > 1 ? (i - (count - 1) / 2) * 6 : 0;
        offsets.set(`${e.from}->${e.to}`, offset);
      });
    }
    return offsets;
  }, [edges]);

  if (templates.length === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000,
      }}>
        <div ref={dialogRef} style={{
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          borderRadius: '12px', padding: '48px', textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}>
          <div style={{ fontSize: '16px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            No node templates
          </div>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div
        ref={dialogRef}
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          width: '90vw',
          maxWidth: '1200px',
          height: '85vh',
          maxHeight: '800px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{title ?? 'Route Connections'}</h3>
          <button onClick={onClose}>Close</button>
        </div>

        {/* SVG area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          <svg
            width={Math.max(svgW, 400)}
            height={Math.max(svgH, 200)}
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="var(--color-text-muted, #888)" />
              </marker>
              {hasRoute && (
                <marker
                  id="arrowhead-active"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#3B82F6" />
                </marker>
              )}
            </defs>

            {/* Edges */}
            {edges.map(e => {
              const from = nodeMap.get(e.from);
              const to = nodeMap.get(e.to);
              if (!from || !to) return null;

              const key = `${e.from}->${e.to}`;
              const yOff = edgeOffsets.get(key) ?? 0;
              const isActive = hasRoute && activeEdgeKeys.has(key);
              const edgeOpacity = hasRoute && !isActive ? 0.2 : 1;
              const edgeStroke = isActive ? '#3B82F6' : 'var(--color-text-muted, #888)';
              const edgeWidth = isActive ? 2.5 : 1.5;
              const marker = isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)';

              // Self-reference (loopback)
              if (e.from === e.to) {
                const cx = from.x + NODE_W / 2;
                const cy = from.y;
                const r = 20;
                return (
                  <path
                    key={key}
                    d={`M ${cx - 10} ${cy} C ${cx - 10} ${cy - r * 2}, ${cx + 10} ${cy - r * 2}, ${cx + 10} ${cy}`}
                    fill="none"
                    stroke={edgeStroke}
                    strokeWidth={edgeWidth}
                    opacity={edgeOpacity}
                    markerEnd={marker}
                  />
                );
              }

              const x1 = from.x + NODE_W;
              const y1 = from.y + NODE_H / 2 + yOff;
              const x2 = to.x;
              const y2 = to.y + NODE_H / 2 + yOff;
              const cpOffset = Math.min(COL_GAP * 0.5, Math.abs(x2 - x1) * 0.4);

              return (
                <path
                  key={key}
                  d={`M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={edgeStroke}
                  strokeWidth={edgeWidth}
                  opacity={edgeOpacity}
                  markerEnd={marker}
                />
              );
            })}

            {/* Nodes */}
            {layoutNodes.map(node => {
              const isOnRoute = hasRoute && activeNodeIds.has(node.id);
              const steps = nodeSteps.get(node.id);
              const nodeOpacity = hasRoute && !isOnRoute ? 0.35 : 1;

              const borderColor = isOnRoute
                ? '#3B82F6'
                : node.isStart
                  ? 'var(--color-success, #22c55e)'
                  : node.incomplete
                    ? 'var(--color-warning, #f59e0b)'
                    : 'var(--color-border, #ccc)';
              const strokeWidth = isOnRoute ? 2.5 : node.isStart ? 2.5 : 1.5;
              const fillColor = isOnRoute ? '#DBEAFE' : 'var(--color-bg, #fff)';
              const dashArray = !isOnRoute && node.incomplete && !node.isStart ? '6 3' : undefined;

              return (
                <g key={node.id} opacity={nodeOpacity}>
                  <rect
                    x={node.x}
                    y={node.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    ry={8}
                    fill={fillColor}
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashArray}
                  />
                  <text
                    x={node.x + NODE_W / 2}
                    y={node.y + (node.isStart ? NODE_H / 2 - 6 : NODE_H / 2)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={13}
                    fontWeight={isOnRoute ? 700 : 600}
                    fill="var(--color-text, #1a1a1a)"
                  >
                    {truncate(node.name, 18)}
                  </text>
                  {node.isStart && (
                    <text
                      x={node.x + NODE_W / 2}
                      y={node.y + NODE_H / 2 + 10}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={10}
                      fontWeight={600}
                      fill={isOnRoute ? '#3B82F6' : 'var(--color-success, #22c55e)'}
                    >
                      START
                    </text>
                  )}
                  {/* Step badge */}
                  {steps && (
                    <>
                      <circle
                        cx={node.x + NODE_W - 4}
                        cy={node.y + 4}
                        r={steps.length > 1 ? 12 : 10}
                        fill="#3B82F6"
                      />
                      <text
                        x={node.x + NODE_W - 4}
                        y={node.y + 4}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={steps.length > 1 ? 9 : 10}
                        fontWeight={700}
                        fill="#fff"
                      >
                        {steps.join(', ')}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend footer */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: '24px', alignItems: 'center',
          fontSize: '12px', color: 'var(--color-text-muted)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              display: 'inline-block', width: '20px', height: '14px',
              border: '2.5px solid var(--color-success, #22c55e)',
              borderRadius: '4px',
            }} />
            Start node
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              display: 'inline-block', width: '20px', height: '14px',
              border: '1.5px dashed var(--color-warning, #f59e0b)',
              borderRadius: '4px',
            }} />
            Incomplete
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="24" height="14">
              <line x1="0" y1="7" x2="20" y2="7" stroke="var(--color-text-muted, #888)" strokeWidth="1.5" markerEnd="url(#legend-arrow)" />
              <defs>
                <marker id="legend-arrow" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
                  <polygon points="0 0, 6 2.5, 0 5" fill="var(--color-text-muted, #888)" />
                </marker>
              </defs>
            </svg>
            Connection (follows)
          </span>
          {hasRoute && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="24" height="14">
                <line x1="0" y1="7" x2="20" y2="7" stroke="#3B82F6" strokeWidth="2.5" markerEnd="url(#legend-arrow-active)" />
                <defs>
                  <marker id="legend-arrow-active" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
                    <polygon points="0 0, 6 2.5, 0 5" fill="#3B82F6" />
                  </marker>
                </defs>
              </svg>
              Current route
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
