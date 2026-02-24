import { RowChangeSummary } from '../../engine/rowDiff';

interface PullFromTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onPushFirst?: () => void;
  templateName: string;
  changeSummary: RowChangeSummary | null;
  hasPendingRecon: boolean;
}

export default function PullFromTemplateDialog({
  open,
  onClose,
  onConfirm,
  onPushFirst,
  templateName,
  changeSummary,
  hasPendingRecon,
}: PullFromTemplateDialogProps) {
  if (!open) return null;

  const hasChanges = changeSummary && (
    changeSummary.added > 0 ||
    changeSummary.removed > 0 ||
    changeSummary.modified > 0
  );

  // In pull direction (compareRows(template, node)):
  //   removed = node has rows the template doesn't → un-pushed additions
  //   modified = rows differ → un-pushed edits
  // Either means the node has local changes that pulling would destroy.
  const hasUnpushedChanges = changeSummary && (
    changeSummary.removed > 0 || changeSummary.modified > 0
  );

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ minWidth: '450px' }}>
        <h2>Pull from Template</h2>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            Template:
          </div>
          <div style={{ fontWeight: 600, fontSize: '16px' }}>
            {templateName}
          </div>
        </div>

        {changeSummary && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              Change Summary:
            </div>
            {hasChanges ? (
              <div style={{
                background: 'var(--color-bg-secondary)',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '14px',
                border: '1px solid var(--color-border)',
              }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                  {changeSummary.added > 0 && (
                    <span style={{ color: 'var(--color-success)' }}>
                      +{changeSummary.added} new from template
                    </span>
                  )}
                  {changeSummary.removed > 0 && (
                    <span style={{ color: 'var(--color-danger)' }}>
                      {changeSummary.removed} un-pushed local {changeSummary.removed === 1 ? 'row' : 'rows'}
                    </span>
                  )}
                  {changeSummary.modified > 0 && (
                    <span style={{ color: 'var(--color-danger)' }}>
                      {changeSummary.modified} un-pushed local {changeSummary.modified === 1 ? 'edit' : 'edits'}
                    </span>
                  )}
                  {changeSummary.unchanged > 0 && (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {changeSummary.unchanged} unchanged
                    </span>
                  )}
                </div>
                {changeSummary.details.length > 0 && (
                  <div style={{
                    maxHeight: '150px',
                    overflow: 'auto',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                  }}>
                    {changeSummary.details.slice(0, 10).map((detail, i) => (
                      <div key={i}>{detail}</div>
                    ))}
                    {changeSummary.details.length > 10 && (
                      <div style={{ fontStyle: 'italic', marginTop: '4px' }}>
                        ...and {changeSummary.details.length - 10} more changes
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: 'var(--color-bg-secondary)',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '14px',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}>
                No changes to pull - node matches template
              </div>
            )}
          </div>
        )}

        {(hasUnpushedChanges || hasPendingRecon) && (
          <div style={{
            padding: '12px',
            background: '#FEE2E2',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#991B1B',
            marginBottom: '16px',
            border: '1px solid #F87171',
            fontWeight: 500,
          }}>
            This node has un-pushed changes that will be lost if you pull.
            Push your changes to the library first.
            {hasPendingRecon && (
              <div style={{ marginTop: '6px' }}>
                Includes un-pushed recon measurements.
              </div>
            )}
          </div>
        )}

        {hasChanges && !hasUnpushedChanges && !hasPendingRecon && (
          <div style={{
            padding: '12px',
            background: 'var(--color-warning-bg, #FEF3C7)',
            borderRadius: '6px',
            fontSize: '13px',
            color: 'var(--color-warning-text, #92400E)',
            marginBottom: '16px',
            border: '1px solid var(--color-warning, #F59E0B)',
          }}>
            This will replace the node's rows with the template data.
          </div>
        )}

        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          {hasUnpushedChanges || hasPendingRecon ? (
            onPushFirst && (
              <button className="primary" onClick={onPushFirst}>
                Push First
              </button>
            )
          ) : (
            hasChanges && (
              <button className="primary" onClick={onConfirm}>
                Pull Changes
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
