import { useState, useMemo } from 'react';
import { useProjectStore, selectCurrentRally, selectCurrentNode, selectIsCurrentRallyLocked, selectReconMode, selectSourceTemplateForNode } from '../../state/projectStore';
import { GridApi } from 'ag-grid-community';
import { compareRows, RowChangeSummary } from '../../engine/rowDiff';
import PushToTemplateDialog from '../Dialogs/PushToTemplateDialog';

interface ToolbarProps {
  gridApi: GridApi | null;
  onImport: () => void;
}

export default function Toolbar({ gridApi, onImport }: ToolbarProps) {
  const currentRally = useProjectStore(selectCurrentRally);
  const currentNode = useProjectStore(selectCurrentNode);
  const addRow = useProjectStore(s => s.addRow);
  const deleteRows = useProjectStore(s => s.deleteRows);
  const duplicateRow = useProjectStore(s => s.duplicateRow);
  const undo = useProjectStore(s => s.undo);
  const redo = useProjectStore(s => s.redo);
  const undoStack = useProjectStore(s => s.undoStack);
  const redoStack = useProjectStore(s => s.redoStack);
  const recalculateTimes = useProjectStore(s => s.recalculateTimes);
  const reconMode = useProjectStore(selectReconMode);
  const toggleReconMode = useProjectStore(s => s.toggleReconMode);
  const isLocked = useProjectStore(selectIsCurrentRallyLocked);
  const pushToTemplate = useProjectStore(s => s.pushToTemplate);
  const editingTemplateId = useProjectStore(s => s.editingTemplateId);

  const [showPushDialog, setShowPushDialog] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Get template for current node (if it came from a template)
  const sourceTemplate = useProjectStore(s =>
    currentNode?.id ? selectSourceTemplateForNode(s, currentNode.id) : null
  );

  // Compute change summary when dialog opens
  const changeSummary = useMemo<RowChangeSummary | null>(() => {
    if (!showPushDialog || !currentNode || !sourceTemplate) return null;
    return compareRows(currentNode.rows, sourceTemplate.rows);
  }, [showPushDialog, currentNode, sourceTemplate]);

  const canPushToTemplate = currentNode?.sourceNodeId && sourceTemplate && !editingTemplateId;

  const handlePushConfirm = () => {
    if (!currentNode) return;
    const success = pushToTemplate(currentNode.id);
    if (success && changeSummary) {
      const total = changeSummary.added + changeSummary.removed + changeSummary.modified;
      setToast(`Template updated with ${total} change${total !== 1 ? 's' : ''}`);
      setTimeout(() => setToast(null), 3000);
    }
    setShowPushDialog(false);
  };

  const getSelectedRowIndex = (): number | null => {
    if (!gridApi) return null;
    const selected = gridApi.getSelectedRows();
    if (selected.length === 0) return null;
    let idx: number | null = null;
    gridApi.forEachNode(node => {
      if (node.data && selected.includes(node.data) && idx === null) {
        idx = node.rowIndex;
      }
    });
    return idx;
  };

  const getSelectedIndices = (): number[] => {
    if (!gridApi) return [];
    const indices: number[] = [];
    const selected = gridApi.getSelectedRows();
    gridApi.forEachNode(node => {
      if (node.data && selected.includes(node.data) && node.rowIndex !== null) {
        indices.push(node.rowIndex);
      }
    });
    return indices;
  };

  const handleAddRow = () => {
    const idx = getSelectedRowIndex();
    addRow(idx ?? undefined);
  };

  const handleDeleteRows = () => {
    const indices = getSelectedIndices();
    if (indices.length === 0) return;
    deleteRows(indices);
  };

  const handleDuplicateRow = () => {
    const idx = getSelectedRowIndex();
    if (idx === null) return;
    duplicateRow(idx);
  };

  const handleRecalculateTimes = () => {
    recalculateTimes();
    setToast('Times recalculated');
    setTimeout(() => setToast(null), 2000);
  };

  const disabled = !currentRally;
  const locked = isLocked;

  const buttonStyle: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: '13px',
    minHeight: '28px',
    lineHeight: '1',
  };

  const groupStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1px',
    background: 'var(--color-border)',
    borderRadius: '6px',
    padding: '1px',
  };

  const groupButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    borderRadius: '0',
    border: 'none',
    background: 'var(--color-bg)',
  };

  const groupButtonFirstStyle: React.CSSProperties = {
    ...groupButtonStyle,
    borderRadius: '5px 0 0 5px',
  };

  const groupButtonLastStyle: React.CSSProperties = {
    ...groupButtonStyle,
    borderRadius: '0 5px 5px 0',
  };

  const groupButtonOnlyStyle: React.CSSProperties = {
    ...groupButtonStyle,
    borderRadius: '5px',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px 12px',
      gap: '12px',
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
    }}>
      {/* Row operations group */}
      <div style={groupStyle}>
        <button
          onClick={handleAddRow}
          disabled={disabled || locked}
          title="Add row after selection (Insert)"
          style={groupButtonFirstStyle}
        >
          + Row
        </button>
        <button
          onClick={handleDeleteRows}
          disabled={disabled || locked}
          title="Delete selected rows (Delete)"
          style={groupButtonStyle}
        >
          - Row
        </button>
        <button
          onClick={handleDuplicateRow}
          disabled={disabled || locked}
          title="Duplicate selected row"
          style={groupButtonLastStyle}
        >
          Copy
        </button>
      </div>

      {/* History group */}
      <div style={groupStyle}>
        <button
          onClick={undo}
          disabled={disabled || locked || undoStack.length === 0}
          title="Undo (Ctrl+Z)"
          style={groupButtonFirstStyle}
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={disabled || locked || redoStack.length === 0}
          title="Redo (Ctrl+Y)"
          style={groupButtonLastStyle}
        >
          Redo
        </button>
      </div>

      {/* Calculation group */}
      <div style={groupStyle}>
        <button
          onClick={handleRecalculateTimes}
          disabled={disabled || locked}
          title="Recalculate all times"
          style={groupButtonFirstStyle}
        >
          Recalc Times
        </button>
        <button
          onClick={toggleReconMode}
          disabled={disabled}
          className={reconMode ? 'primary' : undefined}
          title="Toggle reconnaissance mode (show check/verify columns)"
          style={{ ...groupButtonLastStyle, background: reconMode ? undefined : 'var(--color-bg)' }}
        >
          Recon
        </button>
      </div>

      {/* Template sync */}
      {canPushToTemplate && (
        <div style={groupStyle}>
          <button
            onClick={() => setShowPushDialog(true)}
            disabled={disabled || locked}
            title="Push changes back to the source template in the Node Library"
            style={groupButtonOnlyStyle}
          >
            Push to Library
          </button>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Import */}
      <div style={groupStyle}>
        <button
          onClick={onImport}
          disabled={disabled || locked}
          title="Import CSV file"
          style={groupButtonOnlyStyle}
        >
          Import CSV
        </button>
      </div>

      <PushToTemplateDialog
        open={showPushDialog}
        onClose={() => setShowPushDialog(false)}
        onConfirm={handlePushConfirm}
        templateName={sourceTemplate?.name ?? ''}
        changeSummary={changeSummary}
        error={showPushDialog && !sourceTemplate ? 'Source template no longer exists' : undefined}
      />

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-text)',
          color: 'var(--color-bg)',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
