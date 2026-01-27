import { create } from 'zustand';
import {
  Rally,
  RallyWorkspace,
  RallyDay,
  RouteRow,
  createEmptyRally,
  createEmptyWorkspace,
  createEmptyDay,
  createEmptyRow,
  SpeedLookupEntry,
} from '../types/domain';
import { computeTimes } from '../engine/timeCalculator';
import { getDefaultSpeedLookupTable } from '../engine/speedCalculator';

interface UndoEntry {
  rows: RouteRow[];
  description: string;
}

/** Helper: immutably update the rally matching rallyId within a workspace */
function updateCurrentRally(
  workspace: RallyWorkspace,
  rallyId: string,
  updater: (rally: Rally) => Rally,
): RallyWorkspace {
  return {
    ...workspace,
    rallies: workspace.rallies.map(r =>
      r.id === rallyId ? updater(r) : r,
    ),
    modifiedAt: new Date().toISOString(),
  };
}

interface ProjectState {
  // Workspace data
  workspace: RallyWorkspace | null;
  currentRallyId: string | null;
  currentDayId: string | null;
  filePath: string | null;
  isDirty: boolean;
  lastSaved: string | null;

  // Undo/redo
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

  // Rally management
  addRally: (name: string) => void;
  removeRally: (rallyId: string) => void;
  selectRally: (rallyId: string) => void;
  selectRallyDay: (rallyId: string, dayId: string) => void;
  updateRallyName: (rallyId: string, name: string) => void;
  getCurrentRally: () => Rally | null;

  // Workspace I/O
  loadWorkspace: (workspace: RallyWorkspace, filePath: string) => void;
  setFilePath: (path: string) => void;
  markSaved: () => void;
  getWorkspaceForSave: () => RallyWorkspace | null;

  // Day management
  addDay: (name: string) => void;
  removeDay: (dayId: string) => void;
  selectDay: (dayId: string) => void;
  updateDaySettings: (dayId: string, settings: Partial<Pick<RallyDay, 'startTime' | 'carIntervalSeconds' | 'numberOfCars' | 'name'>>) => void;

  // Row management
  setRows: (rows: RouteRow[]) => void;
  addRow: (afterIndex?: number) => void;
  deleteRows: (indices: number[]) => void;
  duplicateRow: (index: number) => void;
  updateRow: (index: number, updates: Partial<RouteRow>) => void;
  moveRows: (fromIndices: number[], toIndex: number) => void;
  importRows: (rows: RouteRow[]) => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  pushUndo: (description: string) => void;

  // Computation
  recalculateTimes: () => void;

  // Speed tables
  updateSpeedLookupTable: (table: SpeedLookupEntry[]) => void;

  // Getters
  getCurrentDay: () => RallyDay | null;
  getCurrentRows: () => RouteRow[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  workspace: null,
  currentRallyId: null,
  currentDayId: null,
  filePath: null,
  isDirty: false,
  lastSaved: null,
  undoStack: [],
  redoStack: [],

  // --- Rally management ---

  addRally: (name: string) => {
    let { workspace } = get();
    if (!workspace) {
      workspace = createEmptyWorkspace();
    }
    const rally = createEmptyRally(name);
    rally.speedLookupTable = getDefaultSpeedLookupTable();
    const day = createEmptyDay('Day 1');
    rally.days.push(day);
    set({
      workspace: {
        ...workspace,
        rallies: [...workspace.rallies, rally],
        modifiedAt: new Date().toISOString(),
      },
      currentRallyId: rally.id,
      currentDayId: day.id,
      isDirty: true,
      undoStack: [],
      redoStack: [],
    });
  },

  removeRally: (rallyId: string) => {
    const { workspace, currentRallyId } = get();
    if (!workspace) return;
    const rallies = workspace.rallies.filter(r => r.id !== rallyId);
    const removedCurrent = currentRallyId === rallyId;
    const nextRally = removedCurrent ? (rallies[0] ?? null) : workspace.rallies.find(r => r.id === currentRallyId) ?? null;
    set({
      workspace: { ...workspace, rallies, modifiedAt: new Date().toISOString() },
      currentRallyId: removedCurrent ? (nextRally?.id ?? null) : currentRallyId,
      currentDayId: removedCurrent ? (nextRally?.days[0]?.id ?? null) : get().currentDayId,
      isDirty: true,
      undoStack: [],
      redoStack: [],
    });
  },

  selectRally: (rallyId: string) => {
    const { workspace } = get();
    if (!workspace) return;
    const rally = workspace.rallies.find(r => r.id === rallyId);
    if (!rally) return;
    set({
      currentRallyId: rallyId,
      currentDayId: rally.days[0]?.id ?? null,
      undoStack: [],
      redoStack: [],
    });
  },

  selectRallyDay: (rallyId: string, dayId: string) => {
    set({
      currentRallyId: rallyId,
      currentDayId: dayId,
      undoStack: [],
      redoStack: [],
    });
  },

  updateRallyName: (rallyId: string, name: string) => {
    const { workspace } = get();
    if (!workspace) return;
    set({
      workspace: updateCurrentRally(workspace, rallyId, r => ({
        ...r,
        name,
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  getCurrentRally: () => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return null;
    return workspace.rallies.find(r => r.id === currentRallyId) ?? null;
  },

  // --- Workspace I/O ---

  loadWorkspace: (workspace: RallyWorkspace, filePath: string) => {
    const firstRally = workspace.rallies[0] ?? null;
    set({
      workspace,
      currentRallyId: firstRally?.id ?? null,
      currentDayId: firstRally?.days[0]?.id ?? null,
      filePath,
      isDirty: false,
      lastSaved: new Date().toLocaleTimeString(),
      undoStack: [],
      redoStack: [],
    });
  },

  setFilePath: (path: string) => set({ filePath: path }),

  markSaved: () => set({
    isDirty: false,
    lastSaved: new Date().toLocaleTimeString(),
  }),

  getWorkspaceForSave: () => {
    const { workspace } = get();
    if (!workspace) return null;
    return {
      ...workspace,
      modifiedAt: new Date().toISOString(),
    };
  },

  // --- Day management (scoped to current rally) ---

  addDay: (name: string) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    const day = createEmptyDay(name);
    set({
      workspace: updateCurrentRally(workspace, currentRallyId, r => ({
        ...r,
        days: [...r.days, day],
        modifiedAt: new Date().toISOString(),
      })),
      currentDayId: day.id,
      isDirty: true,
    });
  },

  removeDay: (dayId: string) => {
    const { workspace, currentRallyId, currentDayId } = get();
    if (!workspace || !currentRallyId) return;
    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally) return;
    const days = rally.days.filter(d => d.id !== dayId);
    set({
      workspace: updateCurrentRally(workspace, currentRallyId, r => ({
        ...r,
        days,
        modifiedAt: new Date().toISOString(),
      })),
      currentDayId: currentDayId === dayId ? (days[0]?.id ?? null) : currentDayId,
      isDirty: true,
    });
  },

  selectDay: (dayId: string) => set({ currentDayId: dayId, undoStack: [], redoStack: [] }),

  updateDaySettings: (dayId, settings) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    set({
      workspace: updateCurrentRally(workspace, currentRallyId, r => ({
        ...r,
        days: r.days.map(d => d.id === dayId ? { ...d, ...settings } : d),
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  // --- Row management (scoped to current rally + current day) ---

  setRows: (rows: RouteRow[]) => {
    const { workspace, currentRallyId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentDayId) return;
    set({
      workspace: updateCurrentRally(workspace, currentRallyId, r => ({
        ...r,
        days: r.days.map(d => d.id === currentDayId ? { ...d, rows } : d),
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  addRow: (afterIndex?: number) => {
    const state = get();
    state.pushUndo('Add row');
    const day = state.getCurrentDay();
    if (!day) return;
    const rows = [...day.rows];
    const newRow = createEmptyRow();
    if (afterIndex !== undefined && afterIndex >= 0) {
      if (rows[afterIndex]) {
        newRow.rallyDistance = rows[afterIndex].rallyDistance;
        newRow.speedLimit = rows[afterIndex].speedLimit;
      }
      rows.splice(afterIndex + 1, 0, newRow);
    } else {
      rows.push(newRow);
    }
    get().setRows(rows);
  },

  deleteRows: (indices: number[]) => {
    const state = get();
    state.pushUndo('Delete rows');
    const day = state.getCurrentDay();
    if (!day) return;
    const rows = day.rows.filter((_, i) => !indices.includes(i));
    get().setRows(rows);
  },

  duplicateRow: (index: number) => {
    const state = get();
    state.pushUndo('Duplicate row');
    const day = state.getCurrentDay();
    if (!day || !day.rows[index]) return;
    const rows = [...day.rows];
    const copy = { ...rows[index], id: crypto.randomUUID() };
    rows.splice(index + 1, 0, copy);
    get().setRows(rows);
  },

  updateRow: (index: number, updates: Partial<RouteRow>) => {
    const { workspace, currentRallyId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentDayId) return;
    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally) return;
    const day = rally.days.find(d => d.id === currentDayId);
    if (!day || !day.rows[index]) return;

    const newRows = [...day.rows];
    newRows[index] = { ...newRows[index], ...updates };

    set({
      workspace: updateCurrentRally(workspace, currentRallyId, r => ({
        ...r,
        days: r.days.map(d => d.id === currentDayId ? { ...d, rows: newRows } : d),
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  moveRows: (fromIndices: number[], toIndex: number) => {
    const state = get();
    state.pushUndo('Move rows');
    const day = state.getCurrentDay();
    if (!day) return;
    const rows = [...day.rows];
    const moved = fromIndices.sort((a, b) => a - b).map(i => rows[i]);
    for (let i = fromIndices.length - 1; i >= 0; i--) {
      rows.splice(fromIndices[i], 1);
    }
    const insertAt = Math.min(toIndex, rows.length);
    rows.splice(insertAt, 0, ...moved);
    get().setRows(rows);
  },

  importRows: (rows: RouteRow[]) => {
    const state = get();
    const day = state.getCurrentDay();
    if (!day) return;
    if (day.rows.length > 0) {
      state.pushUndo('Import rows');
    }
    get().setRows(rows);
  },

  // --- Undo/redo ---

  undo: () => {
    const { undoStack, redoStack, getCurrentDay, setRows } = get();
    const day = getCurrentDay();
    if (!day || undoStack.length === 0) return;

    const entry = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { rows: [...day.rows], description: entry.description }],
    });
    setRows(entry.rows);
  },

  redo: () => {
    const { undoStack, redoStack, getCurrentDay, setRows } = get();
    const day = getCurrentDay();
    if (!day || redoStack.length === 0) return;

    const entry = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, { rows: [...day.rows], description: entry.description }],
    });
    setRows(entry.rows);
  },

  pushUndo: (description: string) => {
    const { undoStack, getCurrentDay } = get();
    const day = getCurrentDay();
    if (!day) return;
    const newStack = [...undoStack, { rows: [...day.rows], description }];
    if (newStack.length > 50) newStack.shift();
    set({ undoStack: newStack, redoStack: [] });
  },

  // --- Computation ---

  recalculateTimes: () => {
    const { currentDayId, setRows, getCurrentDay } = get();
    if (!currentDayId) return;
    const day = getCurrentDay();
    if (!day) return;

    const updatedRows = computeTimes(
      day.rows,
      day.startTime,
      day.carIntervalSeconds,
      day.numberOfCars,
    );
    setRows(updatedRows);
  },

  // --- Speed tables (scoped to current rally) ---

  updateSpeedLookupTable: (table: SpeedLookupEntry[]) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    set({
      workspace: updateCurrentRally(workspace, currentRallyId, r => ({
        ...r,
        speedLookupTable: table,
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  // --- Getters ---

  getCurrentDay: () => {
    const { workspace, currentRallyId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentDayId) return null;
    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally) return null;
    return rally.days.find(d => d.id === currentDayId) ?? null;
  },

  getCurrentRows: () => {
    const { workspace, currentRallyId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentDayId) return [];
    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally) return [];
    const day = rally.days.find(d => d.id === currentDayId);
    return day?.rows ?? [];
  },
}));
