import { useProjectStore } from '../../state/projectStore';
import { validateNodeConnections } from '../../engine/validator';
import NodePalette from './NodePalette';

export default function RouteBuilder() {
  const getCurrentRally = useProjectStore(s => s.getCurrentRally);
  const getCurrentDay = useProjectStore(s => s.getCurrentDay);
  const selectNode = useProjectStore(s => s.selectNode);
  const removeRouteNode = useProjectStore(s => s.removeRouteNode);
  const moveRouteNode = useProjectStore(s => s.moveRouteNode);
  const placeNode = useProjectStore(s => s.placeNode);
  const isLocked = useProjectStore(s => s.isCurrentRallyLocked());

  const rally = getCurrentRally();
  const day = getCurrentDay();

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
            Route Builder: {day.name}
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
            No nodes yet. Place a template from the palette or add an empty node.
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
                      {/* Insert node button */}
                      {!isLocked && rally.nodeLibrary.length > 0 && (
                        <button
                          style={{ fontSize: '11px', padding: '2px 6px', opacity: 0.6 }}
                          title="Insert node here"
                          onClick={() => {
                            // Place first template at this position as a quick insert
                            if (rally.nodeLibrary.length > 0) {
                              placeNode(rally.nodeLibrary[0].id, index - 1);
                            }
                          }}
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}

                  {/* Node card */}
                  <div
                    style={{
                      padding: '12px 16px',
                      border: '1px solid var(--color-border)',
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
                        {node.name}
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
                      {/* Move buttons */}
                      {!isLocked && (
                        <>
                          <button
                            disabled={index === 0}
                            onClick={e => { e.stopPropagation(); moveRouteNode(index, index - 1); }}
                            title="Move up"
                            style={{ padding: '2px 6px', fontSize: '12px' }}
                          >
                            Up
                          </button>
                          <button
                            disabled={index === nodes.length - 1}
                            onClick={e => { e.stopPropagation(); moveRouteNode(index, index + 1); }}
                            title="Move down"
                            style={{ padding: '2px 6px', fontSize: '12px' }}
                          >
                            Dn
                          </button>
                        </>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); selectNode(node.id); }}
                        style={{ padding: '2px 8px', fontSize: '12px' }}
                      >
                        Edit
                      </button>
                      {!isLocked && nodes.length > 1 && (
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
