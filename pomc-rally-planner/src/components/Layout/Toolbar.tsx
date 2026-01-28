import { useProjectStore, selectCurrentRally, selectIsCurrentRallyLocked, selectReconMode } from '../../state/projectStore';
import { GridApi } from 'ag-grid-community';

interface ToolbarProps {
  gridApi: GridApi | null;
  onImport: () => void;
}

export default function Toolbar({ gridApi, onImport }: ToolbarProps) {
  const currentRally = useProjectStore(selectCurrentRally);
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

  const disabled = !currentRally;
  const locked = isLocked;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '6px 12px',
      gap: '8px',
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
    }}>
      <button onClick={handleAddRow} disabled={disabled || locked} title="Add row after selection (Insert)">
        + Row
      </button>
      <button onClick={handleDeleteRows} disabled={disabled || locked} title="Delete selected rows (Delete)">
        - Row
      </button>
      <button onClick={handleDuplicateRow} disabled={disabled || locked} title="Duplicate selected row">
        Copy Row
      </button>

      <div style={{ width: '1px', height: '28px', background: 'var(--color-border)', margin: '0 4px' }} />

      <button onClick={undo} disabled={disabled || locked || undoStack.length === 0} title="Undo (Ctrl+Z)">
        Undo
      </button>
      <button onClick={redo} disabled={disabled || locked || redoStack.length === 0} title="Redo (Ctrl+Y)">
        Redo
      </button>

      <div style={{ width: '1px', height: '28px', background: 'var(--color-border)', margin: '0 4px' }} />

      <button onClick={recalculateTimes} disabled={disabled || locked} className="primary" title="Recalculate all times">
        Recalc Times
      </button>
      <button
        onClick={toggleReconMode}
        disabled={disabled}
        className={reconMode ? 'primary' : undefined}
        title="Toggle reconnaissance mode (show check/verify columns)"
      >
        Recon Mode
      </button>

      <div style={{ flex: 1 }} />

      <button onClick={onImport} disabled={disabled || locked} title="Import CSV file">
        Import CSV
      </button>
    </div>
  );
}
