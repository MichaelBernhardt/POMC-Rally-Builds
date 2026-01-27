import { create } from 'zustand';
import {
  RallyProject,
  RallyDay,
  RouteRow,
  createEmptyProject,
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

interface ProjectState {
  // Project data
  project: RallyProject | null;
  currentDayId: string | null;
  filePath: string | null;
  isDirty: boolean;
  lastSaved: string | null;

  // Undo/redo
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

  // Actions
  newProject: (name: string) => void;
  loadProject: (project: RallyProject, filePath: string) => void;
  setFilePath: (path: string) => void;
  markSaved: () => void;

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
  getProjectForSave: () => RallyProject | null;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  currentDayId: null,
  filePath: null,
  isDirty: false,
  lastSaved: null,
  undoStack: [],
  redoStack: [],

  newProject: (name: string) => {
    const project = createEmptyProject(name);
    project.speedLookupTable = getDefaultSpeedLookupTable();
    const day = createEmptyDay('Day 1');
    project.days.push(day);
    set({
      project,
      currentDayId: day.id,
      filePath: null,
      isDirty: false,
      undoStack: [],
      redoStack: [],
    });
  },

  loadProject: (project: RallyProject, filePath: string) => {
    set({
      project,
      currentDayId: project.days[0]?.id ?? null,
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

  addDay: (name: string) => {
    const { project } = get();
    if (!project) return;
    const day = createEmptyDay(name);
    set({
      project: {
        ...project,
        days: [...project.days, day],
        modifiedAt: new Date().toISOString(),
      },
      currentDayId: day.id,
      isDirty: true,
    });
  },

  removeDay: (dayId: string) => {
    const { project, currentDayId } = get();
    if (!project) return;
    const days = project.days.filter(d => d.id !== dayId);
    set({
      project: { ...project, days, modifiedAt: new Date().toISOString() },
      currentDayId: currentDayId === dayId ? (days[0]?.id ?? null) : currentDayId,
      isDirty: true,
    });
  },

  selectDay: (dayId: string) => set({ currentDayId: dayId, undoStack: [], redoStack: [] }),

  updateDaySettings: (dayId, settings) => {
    const { project } = get();
    if (!project) return;
    set({
      project: {
        ...project,
        days: project.days.map(d =>
          d.id === dayId ? { ...d, ...settings } : d
        ),
        modifiedAt: new Date().toISOString(),
      },
      isDirty: true,
    });
  },

  setRows: (rows: RouteRow[]) => {
    const { project, currentDayId } = get();
    if (!project || !currentDayId) return;
    set({
      project: {
        ...project,
        days: project.days.map(d =>
          d.id === currentDayId ? { ...d, rows } : d
        ),
        modifiedAt: new Date().toISOString(),
      },
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
      // Copy distance from previous row as starting point
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
    const { project, currentDayId } = get();
    if (!project || !currentDayId) return;
    const day = project.days.find(d => d.id === currentDayId);
    if (!day || !day.rows[index]) return;

    const newRows = [...day.rows];
    newRows[index] = { ...newRows[index], ...updates };

    set({
      project: {
        ...project,
        days: project.days.map(d =>
          d.id === currentDayId ? { ...d, rows: newRows } : d
        ),
        modifiedAt: new Date().toISOString(),
      },
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
    // Remove from original positions (reverse order to preserve indices)
    for (let i = fromIndices.length - 1; i >= 0; i--) {
      rows.splice(fromIndices[i], 1);
    }
    // Insert at target
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
    // Limit undo stack to 50 entries
    if (newStack.length > 50) newStack.shift();
    set({ undoStack: newStack, redoStack: [] });
  },

  recalculateTimes: () => {
    const { project, currentDayId, setRows } = get();
    if (!project || !currentDayId) return;
    const day = project.days.find(d => d.id === currentDayId);
    if (!day) return;

    const updatedRows = computeTimes(
      day.rows,
      day.startTime,
      day.carIntervalSeconds,
      day.numberOfCars,
    );
    setRows(updatedRows);
  },

  updateSpeedLookupTable: (table: SpeedLookupEntry[]) => {
    const { project } = get();
    if (!project) return;
    set({
      project: {
        ...project,
        speedLookupTable: table,
        modifiedAt: new Date().toISOString(),
      },
      isDirty: true,
    });
  },

  getCurrentDay: () => {
    const { project, currentDayId } = get();
    if (!project || !currentDayId) return null;
    return project.days.find(d => d.id === currentDayId) ?? null;
  },

  getCurrentRows: () => {
    const { project, currentDayId } = get();
    if (!project || !currentDayId) return [];
    const day = project.days.find(d => d.id === currentDayId);
    return day?.rows ?? [];
  },

  getProjectForSave: () => {
    const { project } = get();
    if (!project) return null;
    return {
      ...project,
      modifiedAt: new Date().toISOString(),
    };
  },
}));
