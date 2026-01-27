import { useMemo } from 'react';
import { useProjectStore } from '../../state/projectStore';
import { NodeTemplate } from '../../types/domain';
import { isTemplateComplete } from '../../engine/validator';

export default function NodePalette() {
  const getCurrentRally = useProjectStore(s => s.getCurrentRally);
  const getCurrentDay = useProjectStore(s => s.getCurrentDay);
  const placeNode = useProjectStore(s => s.placeNode);
  const setViewMode = useProjectStore(s => s.setViewMode);

  const rally = getCurrentRally();
  const day = getCurrentDay();
  if (!rally) return null;

  // Only consider complete templates (named + has start/link rule)
  const allTemplates = rally.nodeLibrary;
  const templates = allTemplates.filter(isTemplateComplete);
  const incompleteCount = allTemplates.length - templates.length;
  const nodes = day?.nodes ?? [];
  const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
  const hasAnyStartTemplates = templates.some(t => t.isStartNode);

  const { available, unavailable } = useMemo(() => {
    const avail: NodeTemplate[] = [];
    const unavail: { template: NodeTemplate; reason: string }[] = [];

    for (const t of templates) {
      if (nodes.length === 0) {
        // Empty day: only start nodes (or all if none are marked as start)
        if (hasAnyStartTemplates && !t.isStartNode) {
          unavail.push({ template: t, reason: 'Not a start node' });
        } else {
          avail.push(t);
        }
      } else {
        // Has nodes: only "follows" nodes whose previous matches the last placed node
        if (t.isStartNode) {
          unavail.push({ template: t, reason: 'Start node (first position only)' });
        } else if (lastNode && t.allowedPreviousNodes.includes(lastNode.sourceNodeId)) {
          avail.push(t);
        } else {
          const prevName = allTemplates.find(x => x.id === t.allowedPreviousNodes[0])?.name ?? '?';
          unavail.push({ template: t, reason: `Follows: ${prevName}` });
        }
      }
    }

    return { available: avail, unavailable: unavail };
  }, [templates, allTemplates, nodes, lastNode, hasAnyStartTemplates]);

  return (
    <div style={{ padding: '12px' }}>
      <div style={{
        fontWeight: 600,
        fontSize: '13px',
        marginBottom: '12px',
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Node Palette
      </div>

      {nodes.length === 0 && hasAnyStartTemplates && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px', fontStyle: 'italic' }}>
          Showing start nodes only
        </div>
      )}

      {nodes.length > 0 && lastNode && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
          After: <strong>{lastNode.name}</strong>
        </div>
      )}

      {templates.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', padding: '8px 0' }}>
          {allTemplates.length === 0 ? (
            <>
              No templates in library.{' '}
              <span
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setViewMode('library')}
              >
                Create one
              </span>
            </>
          ) : (
            <>
              No complete templates available.{' '}
              <span
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setViewMode('library')}
              >
                Finish setup in library
              </span>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Available templates */}
          {available.map(template => (
            <div
              key={template.id}
              onClick={() => placeNode(template.id)}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                background: 'var(--color-bg)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            >
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {template.name}
                {template.isStartNode && (
                  <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: 400 }}>
                    start
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {template.rows.length} rows
              </div>
            </div>
          ))}

          {/* Unavailable templates (grayed out) */}
          {unavailable.map(({ template, reason }) => (
            <div
              key={template.id}
              style={{
                padding: '8px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                background: 'var(--color-bg-secondary)',
                opacity: 0.5,
                fontSize: '13px',
                cursor: 'not-allowed',
              }}
              title={reason}
            >
              <div style={{ fontWeight: 600 }}>{template.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {reason}
              </div>
            </div>
          ))}

          {/* Incomplete templates notice */}
          {incompleteCount > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--color-warning)', marginTop: '8px', padding: '4px 0' }}>
              {incompleteCount} incomplete {incompleteCount === 1 ? 'template' : 'templates'} hidden.{' '}
              <span
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => setViewMode('library')}
              >
                Fix in library
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
