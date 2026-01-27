import { create } from 'zustand';
import {
  RallyWorkspaceV3,
  RallyV3,
  RallyEdition,
  RouteDay,
  RouteNode,
  RouteRow,
  NodeTemplate,
  createEmptyRallyV3,
  createEmptyWorkspaceV3,
  createEmptyRouteDay,
  createEmptyEdition,
  createEmptyRow,
  createEmptyRouteNode,
  createRouteNode,
  createEmptyNodeTemplate,
  SpeedLookupEntry,
} from '../types/domain';
import { computeTimes } from '../engine/timeCalculator';
import { getDefaultSpeedLookupTable } from '../engine/speedCalculator';
import {
  updateRallyV3,
  updateEdition,
  updateRouteDay,
  updateRouteNode,
  setNodeRows,
  flattenDayRows,
} from './storeHelpers';

type ViewMode = 'grid' | 'library' | 'routeBuilder';

interface UndoEntry {
  rows: RouteRow[];
  nodeId: string;
  description: string;
}

interface ProjectState {
  // Workspace data
  workspace: RallyWorkspaceV3 | null;
  currentRallyId: string | null;
  currentEditionId: string | null;
  currentDayId: string | null;
  currentNodeId: string | null;
  filePath: string | null;
  isDirty: boolean;
  lastSaved: string | null;

  // View mode
  viewMode: ViewMode;
  editingTemplateId: string | null;

  // Undo/redo
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

  // Rally management
  addRally: (name: string) => void;
  removeRally: (rallyId: string) => void;
  selectRally: (rallyId: string) => void;
  selectRallyDay: (rallyId: string, dayId: string) => void;
  updateRallyName: (rallyId: string, name: string) => void;
  toggleRallyLock: (rallyId: string) => void;
  isCurrentRallyLocked: () => boolean;
  getCurrentRally: () => RallyV3 | null;

  // Workspace I/O
  loadWorkspace: (workspace: RallyWorkspaceV3, filePath: string) => void;
  setFilePath: (path: string) => void;
  markSaved: () => void;
  getWorkspaceForSave: () => RallyWorkspaceV3 | null;

  // Edition management
  addEdition: (name: string) => void;
  removeEdition: (editionId: string) => void;
  selectEdition: (editionId: string) => void;
  updateEditionName: (editionId: string, name: string) => void;

  // Day management
  addDay: (name: string) => void;
  removeDay: (dayId: string) => void;
  selectDay: (dayId: string) => void;
  updateDaySettings: (dayId: string, settings: Partial<Pick<RouteDay, 'startTime' | 'carIntervalSeconds' | 'numberOfCars' | 'name'>>) => void;

  // Node management (route building)
  placeNode: (templateId: string, afterIndex?: number) => void;
  removeRouteNode: (nodeId: string) => void;
  moveRouteNode: (fromIndex: number, toIndex: number) => void;
  selectNode: (nodeId: string) => void;
  extractToLibrary: (nodeId: string, name: string) => void;
  addEmptyNode: (name?: string) => void;
  renameRouteNode: (nodeId: string, name: string) => void;

  // Node library
  addNodeTemplate: (opts?: { name?: string; isStartNode?: boolean; allowedPreviousNodes?: string[] }) => void;
  removeNodeTemplate: (templateId: string) => void;
  updateNodeTemplate: (templateId: string, updates: Partial<Pick<NodeTemplate, 'name' | 'description' | 'isStartNode'>>) => void;
  setNodeTemplateRows: (templateId: string, rows: RouteRow[]) => void;
  setAllowedPreviousNodes: (templateId: string, allowedIds: string[]) => void;
  setEditingTemplate: (templateId: string | null) => void;

  // Row management (scoped to current node or editing template)
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

  // View mode
  setViewMode: (mode: ViewMode) => void;

  // Getters
  getCurrentEdition: () => RallyEdition | null;
  getCurrentDay: () => RouteDay | null;
  getCurrentNode: () => RouteNode | null;
  getCurrentRows: () => RouteRow[];
  getDayRows: () => RouteRow[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  workspace: null,
  currentRallyId: null,
  currentEditionId: null,
  currentDayId: null,
  currentNodeId: null,
  filePath: null,
  isDirty: false,
  lastSaved: null,
  viewMode: 'grid',
  editingTemplateId: null,
  undoStack: [],
  redoStack: [],

  // --- Rally management ---

  addRally: (name: string) => {
    let { workspace } = get();
    if (!workspace) {
      workspace = createEmptyWorkspaceV3();
    }
    const rally = createEmptyRallyV3(name);
    rally.speedLookupTable = getDefaultSpeedLookupTable();
    const edition = createEmptyEdition(new Date().getFullYear().toString());
    const day = createEmptyRouteDay('Day 1');
    const node = createEmptyRouteNode('Segment 1');
    day.nodes.push(node);
    edition.days.push(day);
    rally.editions.push(edition);

    set({
      workspace: {
        ...workspace,
        rallies: [...workspace.rallies, rally],
        modifiedAt: new Date().toISOString(),
      },
      currentRallyId: rally.id,
      currentEditionId: edition.id,
      currentDayId: day.id,
      currentNodeId: node.id,
      viewMode: 'grid',
      editingTemplateId: null,
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
    const nextEdition = nextRally?.editions[0] ?? null;
    const nextDay = nextEdition?.days[0] ?? null;
    const nextNode = nextDay?.nodes[0] ?? null;
    set({
      workspace: { ...workspace, rallies, modifiedAt: new Date().toISOString() },
      currentRallyId: removedCurrent ? (nextRally?.id ?? null) : currentRallyId,
      currentEditionId: removedCurrent ? (nextEdition?.id ?? null) : get().currentEditionId,
      currentDayId: removedCurrent ? (nextDay?.id ?? null) : get().currentDayId,
      currentNodeId: removedCurrent ? (nextNode?.id ?? null) : get().currentNodeId,
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
    const edition = rally.editions[0] ?? null;
    const day = edition?.days[0] ?? null;
    const node = day?.nodes[0] ?? null;
    set({
      currentRallyId: rallyId,
      currentEditionId: edition?.id ?? null,
      currentDayId: day?.id ?? null,
      currentNodeId: node?.id ?? null,
      viewMode: 'grid',
      editingTemplateId: null,
      undoStack: [],
      redoStack: [],
    });
  },

  selectRallyDay: (rallyId: string, dayId: string) => {
    const { workspace } = get();
    if (!workspace) return;
    const rally = workspace.rallies.find(r => r.id === rallyId);
    if (!rally) return;
    // Find which edition contains this day
    for (const edition of rally.editions) {
      const day = edition.days.find(d => d.id === dayId);
      if (day) {
        set({
          currentRallyId: rallyId,
          currentEditionId: edition.id,
          currentDayId: dayId,
          currentNodeId: day.nodes[0]?.id ?? null,
          viewMode: 'grid',
          editingTemplateId: null,
          undoStack: [],
          redoStack: [],
        });
        return;
      }
    }
  },

  updateRallyName: (rallyId: string, name: string) => {
    const { workspace } = get();
    if (!workspace) return;
    set({
      workspace: updateRallyV3(workspace, rallyId, r => ({
        ...r,
        name,
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  toggleRallyLock: (rallyId: string) => {
    const { workspace } = get();
    if (!workspace) return;
    set({
      workspace: updateRallyV3(workspace, rallyId, r => ({
        ...r,
        locked: !r.locked,
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  isCurrentRallyLocked: () => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return false;
    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    return rally?.locked === true;
  },

  getCurrentRally: () => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return null;
    return workspace.rallies.find(r => r.id === currentRallyId) ?? null;
  },

  // --- Workspace I/O ---

  loadWorkspace: (workspace: RallyWorkspaceV3, filePath: string) => {
    const firstRally = workspace.rallies[0] ?? null;
    const firstEdition = firstRally?.editions[0] ?? null;
    const firstDay = firstEdition?.days[0] ?? null;
    const firstNode = firstDay?.nodes[0] ?? null;
    set({
      workspace,
      currentRallyId: firstRally?.id ?? null,
      currentEditionId: firstEdition?.id ?? null,
      currentDayId: firstDay?.id ?? null,
      currentNodeId: firstNode?.id ?? null,
      filePath,
      isDirty: false,
      lastSaved: new Date().toLocaleTimeString(),
      viewMode: 'grid',
      editingTemplateId: null,
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

  // --- Edition management ---

  addEdition: (name: string) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    const edition = createEmptyEdition(name);
    const day = createEmptyRouteDay('Day 1');
    const node = createEmptyRouteNode('Segment 1');
    day.nodes.push(node);
    edition.days.push(day);
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        editions: [...r.editions, edition],
        modifiedAt: new Date().toISOString(),
      })),
      currentEditionId: edition.id,
      currentDayId: day.id,
      currentNodeId: node.id,
      viewMode: 'grid',
      isDirty: true,
    });
  },

  removeEdition: (editionId: string) => {
    const { workspace, currentRallyId, currentEditionId } = get();
    if (!workspace || !currentRallyId) return;
    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally || rally.editions.length <= 1) return;
    const editions = rally.editions.filter(e => e.id !== editionId);
    const removedCurrent = currentEditionId === editionId;
    const nextEdition = removedCurrent ? editions[0] : rally.editions.find(e => e.id === currentEditionId);
    const nextDay = removedCurrent ? (nextEdition?.days[0] ?? null) : null;
    const nextNode = nextDay?.nodes[0] ?? null;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        editions,
        modifiedAt: new Date().toISOString(),
      })),
      currentEditionId: removedCurrent ? (nextEdition?.id ?? null) : currentEditionId,
      currentDayId: removedCurrent ? (nextDay?.id ?? null) : get().currentDayId,
      currentNodeId: removedCurrent ? (nextNode?.id ?? null) : get().currentNodeId,
      isDirty: true,
    });
  },

  selectEdition: (editionId: string) => {
    const rally = get().getCurrentRally();
    if (!rally) return;
    const edition = rally.editions.find(e => e.id === editionId);
    if (!edition) return;
    const day = edition.days[0] ?? null;
    const node = day?.nodes[0] ?? null;
    set({
      currentEditionId: editionId,
      currentDayId: day?.id ?? null,
      currentNodeId: node?.id ?? null,
      viewMode: 'grid',
      editingTemplateId: null,
      undoStack: [],
      redoStack: [],
    });
  },

  updateEditionName: (editionId: string, name: string) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, editionId, e => ({ ...e, name })),
      ),
      isDirty: true,
    });
  },

  // --- Day management (scoped to current rally + edition) ---

  addDay: (name: string) => {
    const { workspace, currentRallyId, currentEditionId } = get();
    if (!workspace || !currentRallyId || !currentEditionId) return;
    const day = createEmptyRouteDay(name);
    const node = createEmptyRouteNode('Segment 1');
    day.nodes.push(node);
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, e => ({
          ...e,
          days: [...e.days, day],
        })),
      ),
      currentDayId: day.id,
      currentNodeId: node.id,
      viewMode: 'grid',
      isDirty: true,
    });
  },

  removeDay: (dayId: string) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId) return;
    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally) return;
    const edition = rally.editions.find(e => e.id === currentEditionId);
    if (!edition) return;
    const days = edition.days.filter(d => d.id !== dayId);
    const removedCurrent = currentDayId === dayId;
    const nextDay = removedCurrent ? (days[0] ?? null) : null;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, e => ({
          ...e,
          days,
        })),
      ),
      currentDayId: removedCurrent ? (nextDay?.id ?? null) : currentDayId,
      currentNodeId: removedCurrent ? (nextDay?.nodes[0]?.id ?? null) : get().currentNodeId,
      isDirty: true,
    });
  },

  selectDay: (dayId: string) => {
    const edition = get().getCurrentEdition();
    if (!edition) return;
    const day = edition.days.find(d => d.id === dayId);
    set({
      currentDayId: dayId,
      currentNodeId: day?.nodes[0]?.id ?? null,
      viewMode: 'grid',
      editingTemplateId: null,
      undoStack: [],
      redoStack: [],
    });
  },

  updateDaySettings: (dayId, settings) => {
    const { workspace, currentRallyId, currentEditionId } = get();
    if (!workspace || !currentRallyId || !currentEditionId) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, e =>
          updateRouteDay(e, dayId, d => ({ ...d, ...settings })),
        ),
      ),
      isDirty: true,
    });
  },

  // --- Node management (route building) ---

  placeNode: (templateId: string, afterIndex?: number) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return;
    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally) return;
    const template = rally.nodeLibrary.find(t => t.id === templateId);
    if (!template) return;
    const routeNode = createRouteNode(template);
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, ed =>
          updateRouteDay(ed, currentDayId, day => {
            const nodes = [...day.nodes];
            if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < nodes.length) {
              nodes.splice(afterIndex + 1, 0, routeNode);
            } else {
              nodes.push(routeNode);
            }
            return { ...day, nodes };
          }),
        ),
      ),
      currentNodeId: routeNode.id,
      isDirty: true,
    });
  },

  removeRouteNode: (nodeId: string) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId, currentNodeId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return;
    const day = get().getCurrentDay();
    if (!day) return;
    const nodes = day.nodes.filter(n => n.id !== nodeId);
    const removedCurrent = currentNodeId === nodeId;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, ed =>
          updateRouteDay(ed, currentDayId, d => ({ ...d, nodes })),
        ),
      ),
      currentNodeId: removedCurrent ? (nodes[0]?.id ?? null) : currentNodeId,
      isDirty: true,
    });
  },

  moveRouteNode: (fromIndex: number, toIndex: number) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, ed =>
          updateRouteDay(ed, currentDayId, day => {
            const nodes = [...day.nodes];
            const [moved] = nodes.splice(fromIndex, 1);
            nodes.splice(toIndex, 0, moved);
            return { ...day, nodes };
          }),
        ),
      ),
      isDirty: true,
    });
  },

  selectNode: (nodeId: string) => {
    set({
      currentNodeId: nodeId,
      viewMode: 'grid',
      editingTemplateId: null,
      undoStack: [],
      redoStack: [],
    });
  },

  extractToLibrary: (nodeId: string, name: string) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    const day = get().getCurrentDay();
    if (!day) return;
    const node = day.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const template: NodeTemplate = {
      id: crypto.randomUUID(),
      name,
      description: '',
      rows: node.rows.map(r => ({ ...r, id: crypto.randomUUID() })),
      allowedPreviousNodes: [],
      isStartNode: false,
    };
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        nodeLibrary: [...r.nodeLibrary, template],
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  addEmptyNode: (name?: string) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return;
    const node = createEmptyRouteNode(name);
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, ed =>
          updateRouteDay(ed, currentDayId, day => ({
            ...day,
            nodes: [...day.nodes, node],
          })),
        ),
      ),
      currentNodeId: node.id,
      viewMode: 'grid',
      isDirty: true,
    });
  },

  renameRouteNode: (nodeId: string, name: string) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, ed =>
          updateRouteDay(ed, currentDayId, day => ({
            ...day,
            nodes: day.nodes.map(n => n.id === nodeId ? { ...n, name } : n),
          })),
        ),
      ),
      isDirty: true,
    });
  },

  // --- Node library ---

  addNodeTemplate: (opts) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    const template = createEmptyNodeTemplate(opts?.name);
    if (opts?.isStartNode) template.isStartNode = true;
    if (opts?.allowedPreviousNodes) template.allowedPreviousNodes = opts.allowedPreviousNodes;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        nodeLibrary: [...r.nodeLibrary, template],
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  removeNodeTemplate: (templateId: string) => {
    const { workspace, currentRallyId, editingTemplateId } = get();
    if (!workspace || !currentRallyId) return;
    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally) return;
    // Prevent deletion if another template references this one
    const isReferenced = rally.nodeLibrary.some(
      t => t.id !== templateId && t.allowedPreviousNodes.includes(templateId)
    );
    if (isReferenced) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        nodeLibrary: r.nodeLibrary.filter(t => t.id !== templateId),
        modifiedAt: new Date().toISOString(),
      })),
      editingTemplateId: editingTemplateId === templateId ? null : editingTemplateId,
      isDirty: true,
    });
  },

  updateNodeTemplate: (templateId: string, updates) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        nodeLibrary: r.nodeLibrary.map(t =>
          t.id === templateId ? { ...t, ...updates } : t,
        ),
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  setNodeTemplateRows: (templateId: string, rows: RouteRow[]) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        nodeLibrary: r.nodeLibrary.map(t =>
          t.id === templateId ? { ...t, rows } : t,
        ),
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  setAllowedPreviousNodes: (templateId: string, allowedIds: string[]) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        nodeLibrary: r.nodeLibrary.map(t =>
          t.id === templateId ? { ...t, allowedPreviousNodes: allowedIds } : t,
        ),
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  setEditingTemplate: (templateId: string | null) => {
    set({
      editingTemplateId: templateId,
      viewMode: templateId ? 'grid' : 'library',
      undoStack: [],
      redoStack: [],
    });
  },

  // --- Row management ---

  setRows: (rows: RouteRow[]) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId, currentNodeId, editingTemplateId } = get();
    if (!workspace || !currentRallyId) return;

    // If editing a template, update template rows
    if (editingTemplateId) {
      get().setNodeTemplateRows(editingTemplateId, rows);
      return;
    }

    // Otherwise update node rows
    if (!currentEditionId || !currentDayId || !currentNodeId) return;
    set({
      workspace: setNodeRows(workspace, currentRallyId, currentEditionId, currentDayId, currentNodeId, rows),
      isDirty: true,
    });
  },

  addRow: (afterIndex?: number) => {
    const state = get();
    state.pushUndo('Add row');
    const rows = state.getCurrentRows();
    const newRows = [...rows];
    const newRow = createEmptyRow();
    if (afterIndex !== undefined && afterIndex >= 0) {
      if (newRows[afterIndex]) {
        newRow.rallyDistance = newRows[afterIndex].rallyDistance;
        newRow.speedLimit = newRows[afterIndex].speedLimit;
      }
      newRows.splice(afterIndex + 1, 0, newRow);
    } else {
      newRows.push(newRow);
    }
    get().setRows(newRows);
  },

  deleteRows: (indices: number[]) => {
    const state = get();
    state.pushUndo('Delete rows');
    const rows = state.getCurrentRows();
    const newRows = rows.filter((_, i) => !indices.includes(i));
    get().setRows(newRows);
  },

  duplicateRow: (index: number) => {
    const state = get();
    state.pushUndo('Duplicate row');
    const rows = state.getCurrentRows();
    if (!rows[index]) return;
    const newRows = [...rows];
    const copy = { ...newRows[index], id: crypto.randomUUID() };
    newRows.splice(index + 1, 0, copy);
    get().setRows(newRows);
  },

  updateRow: (index: number, updates: Partial<RouteRow>) => {
    const rows = get().getCurrentRows();
    if (!rows[index]) return;
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], ...updates };
    get().setRows(newRows);
  },

  moveRows: (fromIndices: number[], toIndex: number) => {
    const state = get();
    state.pushUndo('Move rows');
    const rows = [...state.getCurrentRows()];
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
    const currentRows = state.getCurrentRows();
    if (currentRows.length > 0) {
      state.pushUndo('Import rows');
    }
    get().setRows(rows);
  },

  // --- Undo/redo ---

  undo: () => {
    const { undoStack, redoStack, getCurrentRows, setRows, currentNodeId, editingTemplateId } = get();
    const rows = getCurrentRows();
    if (undoStack.length === 0) return;

    const entry = undoStack[undoStack.length - 1];
    // Only undo if we're in the same context (same node or template)
    const contextId = editingTemplateId ?? currentNodeId ?? '';
    if (entry.nodeId !== contextId) return;

    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { rows: [...rows], description: entry.description, nodeId: contextId }],
    });
    setRows(entry.rows);
  },

  redo: () => {
    const { undoStack, redoStack, getCurrentRows, setRows, currentNodeId, editingTemplateId } = get();
    const rows = getCurrentRows();
    if (redoStack.length === 0) return;

    const entry = redoStack[redoStack.length - 1];
    const contextId = editingTemplateId ?? currentNodeId ?? '';
    if (entry.nodeId !== contextId) return;

    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, { rows: [...rows], description: entry.description, nodeId: contextId }],
    });
    setRows(entry.rows);
  },

  pushUndo: (description: string) => {
    const { undoStack, getCurrentRows, currentNodeId, editingTemplateId } = get();
    const rows = getCurrentRows();
    const contextId = editingTemplateId ?? currentNodeId ?? '';
    const newStack = [...undoStack, { rows: [...rows], description, nodeId: contextId }];
    if (newStack.length > 50) newStack.shift();
    set({ undoStack: newStack, redoStack: [] });
  },

  // --- Computation ---

  recalculateTimes: () => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return;

    const day = get().getCurrentDay();
    if (!day) return;

    // Flatten all nodes' rows, compute times, split back
    const allRows = flattenDayRows(day);
    const updatedRows = computeTimes(
      allRows,
      day.startTime,
      day.carIntervalSeconds,
      day.numberOfCars,
    );

    // Split results back into nodes
    let offset = 0;
    const updatedNodes = day.nodes.map(node => {
      const nodeRows = updatedRows.slice(offset, offset + node.rows.length);
      offset += node.rows.length;
      return { ...node, rows: nodeRows };
    });

    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, ed =>
          updateRouteDay(ed, currentDayId, d => ({ ...d, nodes: updatedNodes })),
        ),
      ),
      isDirty: true,
    });
  },

  // --- Speed tables (scoped to current rally) ---

  updateSpeedLookupTable: (table: SpeedLookupEntry[]) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        speedLookupTable: table,
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  // --- View mode ---

  setViewMode: (mode: ViewMode) => {
    set({
      viewMode: mode,
      editingTemplateId: mode !== 'grid' ? null : get().editingTemplateId,
    });
  },

  // --- Getters ---

  getCurrentEdition: () => {
    const { workspace, currentRallyId, currentEditionId } = get();
    if (!workspace || !currentRallyId || !currentEditionId) return null;
    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally) return null;
    return rally.editions.find(e => e.id === currentEditionId) ?? null;
  },

  getCurrentDay: () => {
    const { currentDayId } = get();
    if (!currentDayId) return null;
    const edition = get().getCurrentEdition();
    if (!edition) return null;
    return edition.days.find(d => d.id === currentDayId) ?? null;
  },

  getCurrentNode: () => {
    const { currentNodeId } = get();
    if (!currentNodeId) return null;
    const day = get().getCurrentDay();
    if (!day) return null;
    return day.nodes.find(n => n.id === currentNodeId) ?? null;
  },

  getCurrentRows: () => {
    const { editingTemplateId, currentRallyId, workspace } = get();

    // If editing a library template, return template rows
    if (editingTemplateId && workspace && currentRallyId) {
      const rally = workspace.rallies.find(r => r.id === currentRallyId);
      if (rally) {
        const template = rally.nodeLibrary.find(t => t.id === editingTemplateId);
        if (template) return template.rows;
      }
      return [];
    }

    // Otherwise return current node's rows
    const node = get().getCurrentNode();
    return node?.rows ?? [];
  },

  getDayRows: () => {
    const day = get().getCurrentDay();
    if (!day) return [];
    return flattenDayRows(day);
  },
}));
