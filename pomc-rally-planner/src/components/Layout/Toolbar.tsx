import { useState, useMemo } from 'react';
import { useProjectStore, selectCurrentRally, selectCurrentEdition, selectCurrentDay, selectCurrentNode, selectIsCurrentEditionLocked, selectReconMode, selectSourceTemplateForNode } from '../../state/projectStore';
import { GridApi } from 'ag-grid-community';
import { compareRows, RowChangeSummary } from '../../engine/rowDiff';
import { countEstimableRows } from '../../engine/checkDistEstimator';
import { buildReconBackup, saveReconBackup } from '../../engine/reconBackup';
import PushToTemplateDialog from '../Dialogs/PushToTemplateDialog';
import PullFromTemplateDialog from '../Dialogs/PullFromTemplateDialog';
import ImportMagnumDialog from '../Dialogs/ImportMagnumDialog';

interface ToolbarProps {
  gridApi: GridApi | null;
}

export default function Toolbar({ gridApi }: ToolbarProps) {
  const currentRally = useProjectStore(selectCurrentRally);
  const currentEdition = useProjectStore(selectCurrentEdition);
  const currentDay = useProjectStore(selectCurrentDay);
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
  const isLocked = useProjectStore(selectIsCurrentEditionLocked);
  const pushToTemplate = useProjectStore(s => s.pushToTemplate);
  const editingTemplateId = useProjectStore(s => s.editingTemplateId);

  const [showPushDialog, setShowPushDialog] = useState(false);
  const [showPullDialog, setShowPullDialog] = useState(false);
  const [showMagnumImport, setShowMagnumImport] = useState(false);
  const pullFromTemplate = useProjectStore(s => s.pullFromTemplate);
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

  const estimatedCount = useMemo(() => {
    if (!showPushDialog || !currentNode) return 0;
    return countEstimableRows(currentNode.rows).count;
  }, [showPushDialog, currentNode]);

  const canPushToTemplate = currentNode?.sourceNodeId && sourceTemplate && !editingTemplateId;

  const hasPendingRecon = useMemo(() => {
    if (!currentNode) return false;
    return currentNode.rows.some(r => r.checkDist != null || r.checkLat != null || r.checkLong != null);
  }, [currentNode]);

  const pullChangeSummary = useMemo<RowChangeSummary | null>(() => {
    if (!showPullDialog || !currentNode || !sourceTemplate) return null;
    return compareRows(sourceTemplate.rows, currentNode.rows);
  }, [showPullDialog, currentNode, sourceTemplate]);

  const nodeOutOfSync = useMemo(() => {
    if (!currentNode || !sourceTemplate) return false;
    const s = compareRows(currentNode.rows, sourceTemplate.rows);
    return s.added > 0 || s.removed > 0 || s.modified > 0;
  }, [currentNode, sourceTemplate]);

  const handlePushConfirm = async () => {
    if (!currentNode) return;

    // Save recon backup before pushing (clears checkDist/checkLat/checkLong)
    if (currentRally && currentEdition && currentDay) {
      const backup = buildReconBackup(
        [currentNode],
        currentRally.name,
        currentEdition.name,
        currentDay.name,
      );
      if (backup.nodes.length > 0) {
        await saveReconBackup(backup);
      }
    }

    const success = pushToTemplate(currentNode.id);
    if (success && changeSummary) {
      const total = changeSummary.added + changeSummary.removed + changeSummary.modified;
      setToast(`Template updated with ${total} change${total !== 1 ? 's' : ''}`);
      setTimeout(() => setToast(null), 3000);
    }
    setShowPushDialog(false);
  };

  const handlePullConfirm = () => {
    if (!currentNode) return;
    const result = pullFromTemplate(currentNode.id, true);
    if (result === 'success') {
      setToast('Node updated from template');
      setTimeout(() => setToast(null), 3000);
    }
    setShowPullDialog(false);
  };

  const handlePullPushFirst = () => {
    setShowPullDialog(false);
    setShowPushDialog(true);
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
    const result = recalculateTimes();
    if (result) {
      setToast(`Recalculated ${result.rows} rows across ${result.nodes} nodes — Last car finishes at ${result.lastCar}`);
    } else {
      setToast('Nothing to recalculate');
    }
    setTimeout(() => setToast(null), 3000);
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
          disabled={disabled || locked || !reconMode}
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

      {/* Import */}
      <div style={groupStyle}>
        <button
          onClick={() => setShowMagnumImport(true)}
          disabled={disabled || locked || !currentDay}
          title="Import data from Magnum Rally Excel spreadsheet"
          style={groupButtonOnlyStyle}
        >
          Import Magnum
        </button>
      </div>

      {/* Template sync */}
      {canPushToTemplate && (
        <div style={groupStyle}>
          <button
            onClick={() => setShowPushDialog(true)}
            disabled={disabled || locked}
            title="Push changes to the source template"
            style={groupButtonFirstStyle}
          >
            Push to Library
          </button>
          <button
            onClick={() => setShowPullDialog(true)}
            disabled={disabled || locked || !nodeOutOfSync}
            title="Pull latest template data into this node"
            style={groupButtonLastStyle}
          >
            Pull from Template
          </button>
        </div>
      )}

      <div style={{ flex: 1 }} />

      <PushToTemplateDialog
        open={showPushDialog}
        onClose={() => setShowPushDialog(false)}
        onConfirm={handlePushConfirm}
        templateName={sourceTemplate?.name ?? ''}
        changeSummary={changeSummary}
        error={showPushDialog && !sourceTemplate ? 'Source template no longer exists' : undefined}
        estimatedCount={estimatedCount}
      />

      <PullFromTemplateDialog
        open={showPullDialog}
        onClose={() => setShowPullDialog(false)}
        onConfirm={handlePullConfirm}
        onPushFirst={handlePullPushFirst}
        templateName={sourceTemplate?.name ?? ''}
        changeSummary={pullChangeSummary}
        hasPendingRecon={hasPendingRecon}
      />

      <ImportMagnumDialog
        open={showMagnumImport}
        onClose={() => setShowMagnumImport(false)}
        onComplete={msg => {
          setToast(msg);
          setTimeout(() => setToast(null), 4000);
        }}
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
