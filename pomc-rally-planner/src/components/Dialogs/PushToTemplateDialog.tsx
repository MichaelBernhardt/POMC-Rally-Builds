import { RowChangeSummary } from '../../engine/rowDiff';

interface PushToTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  templateName: string;
  changeSummary: RowChangeSummary | null;
  error?: string;
}

export default function PushToTemplateDialog({
  open,
  onClose,
  onConfirm,
  templateName,
  changeSummary,
  error,
}: PushToTemplateDialogProps) {
  if (!open) return null;

  const hasChanges = changeSummary && (
    changeSummary.added > 0 ||
    changeSummary.removed > 0 ||
    changeSummary.modified > 0
  );

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ minWidth: '450px' }}>
        <h2>Push to Template</h2>

        {error ? (
          <div style={{ color: 'var(--color-danger)', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        ) : (
          <>
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
                          +{changeSummary.added} added
                        </span>
                      )}
                      {changeSummary.removed > 0 && (
                        <span style={{ color: 'var(--color-danger)' }}>
                          -{changeSummary.removed} removed
                        </span>
                      )}
                      {changeSummary.modified > 0 && (
                        <span style={{ color: 'var(--color-warning)' }}>
                          {changeSummary.modified} modified
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
                    No changes to push - node matches template
                  </div>
                )}
              </div>
            )}

            {hasChanges && (
              <div style={{
                padding: '12px',
                background: 'var(--color-warning-bg, #FEF3C7)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--color-warning-text, #92400E)',
                marginBottom: '16px',
                border: '1px solid var(--color-warning, #F59E0B)',
              }}>
                This will update the template. Already-placed nodes will not be affected.
              </div>
            )}
          </>
        )}

        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          {hasChanges && !error && (
            <button className="primary" onClick={onConfirm}>
              Push Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
