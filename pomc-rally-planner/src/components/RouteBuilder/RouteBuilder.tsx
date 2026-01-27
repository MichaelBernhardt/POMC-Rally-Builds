import { useProjectStore } from '../../state/projectStore';
import { validateNodeConnections } from '../../engine/validator';
import NodePalette from './NodePalette';

export default function RouteBuilder() {
  const rally = useProjectStore(s => s.getCurrentRally());
  const day = useProjectStore(s => s.getCurrentDay());
  const selectNode = useProjectStore(s => s.selectNode);
  const removeRouteNode = useProjectStore(s => s.removeRouteNode);
  const renameRouteNode = useProjectStore(s => s.renameRouteNode);
  const isLocked = useProjectStore(s => s.isCurrentRallyLocked());

  if (!rally || !day) {
    return (
      <div style={{ padding: '24px', color: 'var(--color-text-muted)', fontSize: '15px' }}>
        Select a day to build its route.
      </div>
    );
  }

  const nodes = day.nodes;
  const connectionErrors = validateNodeConnections(nodes, rally.nodeLibrary);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Main route area */}
      <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            Route Builder: <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>{rally.name}</span> {day.name}
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
          </div>
        </div>

        {nodes.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            border: '2px dashed var(--color-border)',
            borderRadius: '8px',
            fontSize: '15px',
          }}>
            No nodes yet. Place a template from the palette on the right.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {nodes.map((node, index) => {
              // Check connection error between this node and previous
              const connectionError = connectionErrors.find(e => e.nodeIndex === index);
              const firstDist = node.rows.length > 0 ? node.rows[0].rallyDistance : 0;
              const lastDist = node.rows.length > 0 ? node.rows[node.rows.length - 1].rallyDistance : 0;

              return (
                <div key={node.id}>
                  {/* Connection indicator */}
                  {index > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px 0',
                      gap: '6px',
                    }}>
                      <div style={{
                        width: '2px',
                        height: '16px',
                        background: connectionError ? 'var(--color-warning)' : 'var(--color-border)',
                      }} />
                      {connectionError && (
                        <span style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 600 }}>
                          {connectionError.message}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Start node warning (index 0 only) */}
                  {index === 0 && connectionError && (
                    <div style={{ fontSize: '11px', color: 'var(--color-warning)', fontWeight: 600, marginBottom: '4px', textAlign: 'center' }}>
                      {connectionError.message}
                    </div>
                  )}

                  {/* Node card */}
                  <div
                    style={{
                      padding: '12px 16px',
                      border: `1px solid ${connectionError ? 'var(--color-warning)' : 'var(--color-border)'}`,
                      borderRadius: '8px',
                      background: 'var(--color-bg)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    onDoubleClick={() => selectNode(node.id)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '2px' }}>
                        {isLocked ? node.name : (
                          <input
                            type="text"
                            value={node.name}
                            onChange={e => renameRouteNode(node.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            onDoubleClick={e => e.stopPropagation()}
                            style={{
                              fontWeight: 600,
                              fontSize: '15px',
                              border: '1px solid transparent',
                              borderRadius: '4px',
                              padding: '1px 4px',
                              background: 'transparent',
                              width: '100%',
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'var(--color-bg)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                          />
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {node.rows.length} rows
                        {node.rows.length > 0 && (
                          <> {' \u2022 '} {firstDist.toFixed(2)} - {lastDist.toFixed(2)} km</>
                        )}
                        {node.sourceNodeId && (
                          <> {' \u2022 '} from template</>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        onClick={e => { e.stopPropagation(); selectNode(node.id); }}
                        style={{ padding: '2px 8px', fontSize: '12px' }}
                      >
                        Edit
                      </button>
                      {!isLocked && index === nodes.length - 1 && (
                        <button
                          onClick={e => { e.stopPropagation(); removeRouteNode(node.id); }}
                          style={{ padding: '2px 8px', fontSize: '12px', color: 'var(--color-danger)' }}
                        >
                          Del
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Palette sidebar */}
      {!isLocked && (
        <div style={{
          width: '240px',
          borderLeft: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
          overflow: 'auto',
        }}>
          <NodePalette />
        </div>
      )}
    </div>
  );
}
