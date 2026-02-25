import { create } from 'zustand';
import {
  RallyWorkspaceV3,
  RallyV3,
  RallyEdition,
  RouteDay,
  RouteNode,
  RouteRow,
  NodeTemplate,
  SpeedGroupSettings,
  createEmptyRallyV3,
  createEmptyWorkspaceV3,
  createEmptyRouteDay,
  createEmptyEdition,
  createEmptyRow,
  createEmptyRouteNode,
  createRouteNode,
  createEmptyNodeTemplate,
  resolveSpeedGroupSettings,
  SpeedLookupEntry,
  TimeAddLookupEntry,
} from '../types/domain';
import { computeTimes, recalculateSpeeds } from '../engine/timeCalculator';
import { getDefaultSpeedLookupTable } from '../engine/speedCalculator';
import {
  updateRallyV3,
  updateEdition,
  updateRouteDay,
  updateRouteNode,
  setNodeRows,
  flattenDayRows,
  findNodeForFlatIndex,
} from './storeHelpers';
import { rowFingerprint, buildMatchMap } from '../engine/rowDiff';

type ViewMode = 'grid' | 'library' | 'routeBuilder' | 'speedTables';

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
  routeBuilderTab: 'nodes' | 'table';
  editingTemplateId: string | null;

  // Recon mode (UI-only, not persisted)
  reconMode: boolean;

  // Undo/redo
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

  // Rally management
  addRally: (name: string, editionName?: string) => void;
  removeRally: (rallyId: string) => void;
  selectRally: (rallyId: string) => void;
  selectRallyDay: (rallyId: string, dayId: string) => void;
  updateRallyName: (rallyId: string, name: string) => void;
  toggleEditionLock: (editionId: string) => void;
  isCurrentEditionLocked: () => boolean;
  getCurrentRally: () => RallyV3 | null;

  // Workspace I/O
  loadWorkspace: (workspace: RallyWorkspaceV3, filePath: string) => void;
  setFilePath: (path: string) => void;
  markSaved: () => void;
  resetWorkspace: () => void;
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
  updateDaySettings: (dayId: string, settings: Partial<Pick<RouteDay, 'startTime' | 'carIntervalSeconds' | 'numberOfCars' | 'name' | 'reconDistanceTolerance' | 'speedGroupSettings'>>) => void;

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
  pushToTemplate: (nodeId: string) => boolean;
  pullFromTemplate: (nodeId: string, force?: boolean) => 'success' | 'has_pending_recon' | 'not_found';

  // Row management (scoped to current node or editing template)
  setRows: (rows: RouteRow[]) => void;
  addRow: (afterIndex?: number) => void;
  deleteRows: (indices: number[]) => void;
  duplicateRow: (index: number) => void;
  updateRow: (index: number, updates: Partial<RouteRow>) => void;
  moveRows: (fromIndices: number[], toIndex: number) => void;
  importRows: (rows: RouteRow[]) => void;

  // Day-level row management (for Route Builder table view)
  addRowToDay: (afterFlatIndex?: number) => void;
  updateDayRow: (flatIndex: number, updates: Partial<RouteRow>) => void;
  deleteDayRows: (flatIndices: number[]) => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  pushUndo: (description: string) => void;

  // Computation
  recalculateTimes: () => { rows: number; nodes: number; firstCar: string; lastCar: string } | null;

  // Speed tables
  updateSpeedLookupTable: (table: SpeedLookupEntry[]) => void;
  updateTimeAddLookupTable: (table: TimeAddLookupEntry[]) => void;
  updateSpeedLimitMargin: (percent: number) => void;

  // View mode
  setViewMode: (mode: ViewMode) => void;
  setRouteBuilderTab: (tab: 'nodes' | 'table') => void;
  toggleReconMode: () => void;
  clearCheckDistances: () => void;

  // Getters
  getCurrentEdition: () => RallyEdition | null;
  getCurrentDay: () => RouteDay | null;
  getCurrentNode: () => RouteNode | null;
  getCurrentRows: () => RouteRow[];
  getDayRows: () => RouteRow[];
}

/**
 * Process a node row's recon data into the template's history fields.
 * - Distance: if checkDist is non-null, appends to distanceHistory with today's date.
 *   rallyDistance = average of last 3 entries.
 * - Lat/Long: if lat or long is non-zero, appends to latHistory/longHistory with today's date.
 *   Template lat/long = average of last 3 entries (rounded to 6dp).
 *   If both zero, preserves the template's existing history and values.
 */
function processReconHistory(
  nodeRow: RouteRow,
  templateRow: RouteRow | null,
): RouteRow {
  const today = new Date().toISOString().slice(0, 10);

  // For rows added in recon, the adjusted distance was already written to
  // distanceHistory during cell editing — preserve it as-is.
  if (nodeRow.addedInRecon) {
    const latHistory = nodeRow.latHistory;
    const longHistory = nodeRow.longHistory;
    const lat = nodeRow.lat;
    const long = nodeRow.long;

    // Still process lat/long recon if present
    let finalLatHistory = latHistory;
    let finalLongHistory = longHistory;
    let finalLat = lat;
    let finalLong = long;
    if (nodeRow.checkLat != null || nodeRow.checkLong != null) {
      const pushLat = nodeRow.checkLat ?? 0;
      const pushLong = nodeRow.checkLong ?? 0;
      finalLatHistory = [...latHistory, { value: pushLat, date: today }];
      finalLongHistory = [...longHistory, { value: pushLong, date: today }];
      const lastLat3 = finalLatHistory.slice(-3);
      const lastLong3 = finalLongHistory.slice(-3);
      finalLat = Math.round((lastLat3.reduce((s, e) => s + e.value, 0) / lastLat3.length) * 1e6) / 1e6;
      finalLong = Math.round((lastLong3.reduce((s, e) => s + e.value, 0) / lastLong3.length) * 1e6) / 1e6;
    }

    return {
      ...nodeRow,
      id: crypto.randomUUID(),
      checkDist: null,
      checkLat: null,
      checkLong: null,
      distanceOverride: undefined,
      coordOverride: undefined,
      addedInRecon: undefined,
      distanceHistory: nodeRow.distanceHistory,
      latHistory: finalLatHistory,
      longHistory: finalLongHistory,
      rallyDistance: nodeRow.rallyDistance,
      lat: finalLat,
      long: finalLong,
    };
  }

  // If distanceOverride is set, the user manually edited the value — start fresh
  const existingDistHistory = nodeRow.distanceOverride
    ? []
    : (templateRow?.distanceHistory ?? []);

  // If coordOverride is set, the user manually edited lat/long — start fresh
  const existingLatHistory = nodeRow.coordOverride
    ? []
    : (templateRow?.latHistory ?? []);
  const existingLongHistory = nodeRow.coordOverride
    ? []
    : (templateRow?.longHistory ?? []);

  let distanceHistory = existingDistHistory;
  let rallyDistance = nodeRow.distanceOverride
    ? nodeRow.rallyDistance
    : (templateRow?.rallyDistance ?? nodeRow.rallyDistance);

  if (nodeRow.checkDist != null) {
    distanceHistory = [...existingDistHistory, { value: nodeRow.checkDist, date: today }];
    const last3 = distanceHistory.slice(-3);
    const avg = last3.reduce((sum, e) => sum + e.value, 0) / last3.length;
    rallyDistance = Math.round(avg * 100) / 100;
  }

  let latHistory = existingLatHistory;
  let longHistory = existingLongHistory;
  let lat = nodeRow.coordOverride
    ? nodeRow.lat
    : (templateRow?.lat ?? nodeRow.lat);
  let long = nodeRow.coordOverride
    ? nodeRow.long
    : (templateRow?.long ?? nodeRow.long);

  if (nodeRow.checkLat != null || nodeRow.checkLong != null) {
    const pushLat = nodeRow.checkLat ?? 0;
    const pushLong = nodeRow.checkLong ?? 0;
    latHistory = [...existingLatHistory, { value: pushLat, date: today }];
    longHistory = [...existingLongHistory, { value: pushLong, date: today }];
    const lastLat3 = latHistory.slice(-3);
    const lastLong3 = longHistory.slice(-3);
    lat = Math.round((lastLat3.reduce((s, e) => s + e.value, 0) / lastLat3.length) * 1e6) / 1e6;
    long = Math.round((lastLong3.reduce((s, e) => s + e.value, 0) / lastLong3.length) * 1e6) / 1e6;
  }

  return {
    ...nodeRow,
    id: crypto.randomUUID(),
    checkDist: null,
    checkLat: null,
    checkLong: null,
    distanceOverride: undefined,
    coordOverride: undefined,
    addedInRecon: undefined,
    distanceHistory,
    latHistory,
    longHistory,
    rallyDistance,
    lat,
    long,
  };
}

/**
 * Compute an adjusted rally distance for a newly-added recon row.
 * Walks backwards from `currentIndex - 1`, collects up to 3 preceding rows
 * that have both a checkDist and a non-zero rallyDistance, computes the average
 * delta (checkDist - rallyDistance), and returns newCheckDist - avgDelta.
 * Returns null if no qualifying rows exist.
 */
function computeAutoRallyDistance(
  rows: RouteRow[],
  currentIndex: number,
  newCheckDist: number,
): number | null {
  const deltas: number[] = [];
  for (let i = currentIndex - 1; i >= 0 && deltas.length < 3; i--) {
    const r = rows[i];
    if (r.checkDist != null && r.rallyDistance !== 0) {
      deltas.push(r.checkDist - r.rallyDistance);
    }
  }
  if (deltas.length === 0) return null;
  const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  return Math.round((newCheckDist - avgDelta) * 100) / 100;
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
  routeBuilderTab: 'nodes',
  editingTemplateId: null,
  reconMode: false,
  undoStack: [],
  redoStack: [],

  // --- Rally management ---

  addRally: (name: string, editionName?: string) => {
    let { workspace } = get();
    if (!workspace) {
      workspace = createEmptyWorkspaceV3();
    }
    const rally = createEmptyRallyV3(name);
    rally.speedLookupTable = getDefaultSpeedLookupTable();
    const edition = createEmptyEdition(editionName ?? new Date().getFullYear().toString());
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

  toggleEditionLock: (editionId: string) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        editions: r.editions.map(e =>
          e.id === editionId ? { ...e, locked: !e.locked } : e,
        ),
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  isCurrentEditionLocked: () => {
    const { workspace, currentRallyId, currentEditionId } = get();
    if (!workspace || !currentRallyId || !currentEditionId) return false;
    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    const edition = rally?.editions.find(e => e.id === currentEditionId);
    return edition?.locked === true;
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
      routeBuilderTab: 'nodes',
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

  resetWorkspace: () => set({
    workspace: null,
    currentRallyId: null,
    currentEditionId: null,
    currentDayId: null,
    currentNodeId: null,
    filePath: null,
    isDirty: false,
    lastSaved: null,
    viewMode: 'grid',
    routeBuilderTab: 'nodes',
    editingTemplateId: null,
    undoStack: [],
    redoStack: [],
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
      viewMode: 'routeBuilder',
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
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, e => ({
          ...e,
          days: [...e.days, day],
        })),
      ),
      currentDayId: day.id,
      currentNodeId: null,
      viewMode: 'routeBuilder',
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
      viewMode: 'library',
      undoStack: [],
      redoStack: [],
    });
  },

  pushToTemplate: (nodeId: string) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return false;

    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally) return false;

    const edition = rally.editions.find(e => e.id === currentEditionId);
    if (!edition) return false;

    const day = edition.days.find(d => d.id === currentDayId);
    if (!day) return false;

    const node = day.nodes.find(n => n.id === nodeId);
    if (!node || !node.sourceNodeId) return false;

    const template = rally.nodeLibrary.find(t => t.id === node.sourceNodeId);
    if (!template) return false;

    // Match node rows to template rows by content, not position.
    // This prevents an insertion from shifting all subsequent matches,
    // and pairs modified rows (e.g. with pending checkDist) to the correct template.
    const nodeFps = node.rows.map(rowFingerprint);
    const templateFps = template.rows.map(rowFingerprint);
    const nodeToTemplate = buildMatchMap(nodeFps, templateFps);

    // Process each node row: merge checkDist + lat/long into history, compute averages
    // checkDist is the exact measured value from recon — store it as-is
    const newTemplateRows = node.rows.map((r, i) => {
      const ti = nodeToTemplate.get(i);
      return processReconHistory(r, ti != null ? template.rows[ti] : null);
    });

    // Refresh the node's rows: pick up new averaged values, clear checkDist
    const refreshedNodeRows = node.rows.map((r, i) => {
      const updated = newTemplateRows[i];
      return updated
        ? { ...r, rallyDistance: updated.rallyDistance, lat: updated.lat, long: updated.long, checkDist: null, checkLat: null, checkLong: null, distanceOverride: undefined, coordOverride: undefined, addedInRecon: undefined }
        : r;
    });

    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => {
        // Update the template in the library
        const updatedLibrary = r.nodeLibrary.map(t =>
          t.id === node.sourceNodeId ? { ...t, rows: newTemplateRows } : t,
        );
        // Update the node's rows in the current day (immutable at every level)
        const updatedEditions = r.editions.map(e => {
          if (e.id !== currentEditionId) return e;
          return {
            ...e,
            days: e.days.map(d => {
              if (d.id !== currentDayId) return d;
              return {
                ...d,
                nodes: d.nodes.map(n => {
                  if (n.id !== nodeId) return n;
                  return { ...n, rows: refreshedNodeRows };
                }),
              };
            }),
          };
        });
        return {
          ...r,
          nodeLibrary: updatedLibrary,
          editions: updatedEditions,
          modifiedAt: new Date().toISOString(),
        };
      }),
      isDirty: true,
    });

    return true;
  },

  pullFromTemplate: (nodeId: string, force?: boolean) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return 'not_found';

    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally) return 'not_found';

    const edition = rally.editions.find(e => e.id === currentEditionId);
    if (!edition) return 'not_found';

    const day = edition.days.find(d => d.id === currentDayId);
    if (!day) return 'not_found';

    const node = day.nodes.find(n => n.id === nodeId);
    if (!node || !node.sourceNodeId) return 'not_found';

    const template = rally.nodeLibrary.find(t => t.id === node.sourceNodeId);
    if (!template) return 'not_found';

    // Check for un-pushed recon data
    if (!force) {
      const hasPendingRecon = node.rows.some(
        r => r.checkDist != null || r.checkLat != null || r.checkLong != null
      );
      if (hasPendingRecon) return 'has_pending_recon';
    }

    // Save undo state before replacing rows
    get().pushUndo('Pull from template');

    // Replace node rows with template rows (new IDs, clear overrides)
    const newRows = template.rows.map(r => ({
      ...r,
      id: crypto.randomUUID(),
      distanceOverride: undefined,
      coordOverride: undefined,
    }));

    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        editions: r.editions.map(e => {
          if (e.id !== currentEditionId) return e;
          return {
            ...e,
            days: e.days.map(d => {
              if (d.id !== currentDayId) return d;
              return {
                ...d,
                nodes: d.nodes.map(n => {
                  if (n.id !== nodeId) return n;
                  return { ...n, rows: newRows };
                }),
              };
            }),
          };
        }),
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });

    return 'success';
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
    if (state.reconMode) newRow.addedInRecon = true;
    if (afterIndex !== undefined && afterIndex >= 0) {
      if (newRows[afterIndex]) {
        newRow.speedLimit = newRows[afterIndex].speedLimit;
        newRow.aSpeed = newRows[afterIndex].aSpeed;
        newRow.bSpeed = newRows[afterIndex].bSpeed;
        newRow.cSpeed = newRows[afterIndex].cSpeed;
        newRow.dSpeed = newRows[afterIndex].dSpeed;
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
    let merged = { ...newRows[index], ...updates };

    // Auto-compute rallyDistance for rows added during recon
    if (
      merged.addedInRecon &&
      !merged.distanceOverride &&
      'checkDist' in updates &&
      updates.checkDist != null
    ) {
      const auto = computeAutoRallyDistance(rows, index, updates.checkDist);
      if (auto != null) {
        const today = new Date().toISOString().slice(0, 10);
        const newHistory = [...merged.distanceHistory, { value: auto, date: today }];
        const last3 = newHistory.slice(-3);
        const avg = Math.round((last3.reduce((s, e) => s + e.value, 0) / last3.length) * 100) / 100;
        merged = { ...merged, distanceHistory: newHistory, rallyDistance: avg };
      }
    }

    newRows[index] = merged;
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

  // --- Day-level row management (for Route Builder table view) ---

  addRowToDay: (afterFlatIndex?: number) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return;

    const day = get().getCurrentDay();
    if (!day || day.nodes.length === 0) return;

    const newRow = createEmptyRow();
    if (get().reconMode) newRow.addedInRecon = true;

    // If afterFlatIndex provided, find which node and insert there
    if (afterFlatIndex !== undefined && afterFlatIndex >= 0) {
      const location = findNodeForFlatIndex(day, afterFlatIndex);
      if (location) {
        const { nodeIndex, localIndex } = location;
        const targetNode = day.nodes[nodeIndex];
        // Copy speed from current row (distance comes from recon)
        if (targetNode.rows[localIndex]) {
          newRow.speedLimit = targetNode.rows[localIndex].speedLimit;
          newRow.aSpeed = targetNode.rows[localIndex].aSpeed;
          newRow.bSpeed = targetNode.rows[localIndex].bSpeed;
          newRow.cSpeed = targetNode.rows[localIndex].cSpeed;
          newRow.dSpeed = targetNode.rows[localIndex].dSpeed;
        }

        const updatedNodes = day.nodes.map((node, idx) => {
          if (idx === nodeIndex) {
            const newRows = [...node.rows];
            newRows.splice(localIndex + 1, 0, newRow);
            return { ...node, rows: newRows };
          }
          return node;
        });

        set({
          workspace: updateRallyV3(workspace, currentRallyId, r =>
            updateEdition(r, currentEditionId, ed =>
              updateRouteDay(ed, currentDayId, d => ({ ...d, nodes: updatedNodes })),
            ),
          ),
          isDirty: true,
        });
        return;
      }
    }

    // Default: append to last node
    const lastNode = day.nodes[day.nodes.length - 1];
    if (lastNode.rows.length > 0) {
      const lastRow = lastNode.rows[lastNode.rows.length - 1];
      newRow.rallyDistance = lastRow.rallyDistance;
      newRow.speedLimit = lastRow.speedLimit;
      newRow.aSpeed = lastRow.aSpeed;
      newRow.bSpeed = lastRow.bSpeed;
      newRow.cSpeed = lastRow.cSpeed;
      newRow.dSpeed = lastRow.dSpeed;
    }

    const updatedNodes = day.nodes.map((node, idx) => {
      if (idx === day.nodes.length - 1) {
        return { ...node, rows: [...node.rows, newRow] };
      }
      return node;
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

  updateDayRow: (flatIndex: number, updates: Partial<RouteRow>) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return;

    const day = get().getCurrentDay();
    if (!day) return;

    const location = findNodeForFlatIndex(day, flatIndex);
    if (!location) return;

    const { nodeIndex, localIndex } = location;
    const updatedNodes = day.nodes.map((node, idx) => {
      if (idx === nodeIndex) {
        const newRows = [...node.rows];
        let merged = { ...newRows[localIndex], ...updates };

        // Auto-compute rallyDistance for rows added during recon
        if (
          merged.addedInRecon &&
          !merged.distanceOverride &&
          'checkDist' in updates &&
          updates.checkDist != null
        ) {
          const auto = computeAutoRallyDistance(node.rows, localIndex, updates.checkDist);
          if (auto != null) {
            const today = new Date().toISOString().slice(0, 10);
            const newHistory = [...merged.distanceHistory, { value: auto, date: today }];
            const last3 = newHistory.slice(-3);
            const avg = Math.round((last3.reduce((s, e) => s + e.value, 0) / last3.length) * 100) / 100;
            merged = { ...merged, distanceHistory: newHistory, rallyDistance: avg };
          }
        }

        newRows[localIndex] = merged;
        return { ...node, rows: newRows };
      }
      return node;
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

  deleteDayRows: (flatIndices: number[]) => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return;
    if (flatIndices.length === 0) return;

    const day = get().getCurrentDay();
    if (!day) return;

    // Build a set of row IDs to delete
    const flatRows = flattenDayRows(day);
    const idsToDelete = new Set(flatIndices.map(i => flatRows[i]?.id).filter(Boolean));

    const updatedNodes = day.nodes.map(node => ({
      ...node,
      rows: node.rows.filter(row => !idsToDelete.has(row.id)),
    }));

    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, ed =>
          updateRouteDay(ed, currentDayId, d => ({ ...d, nodes: updatedNodes })),
        ),
      ),
      isDirty: true,
    });
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
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return null;

    const rally = workspace.rallies.find(r => r.id === currentRallyId);
    if (!rally) return null;

    const day = get().getCurrentDay();
    if (!day) return null;

    // Flatten all nodes' rows with chained distances
    const allRows = flattenDayRows(day);

    // Step 1: Recalculate B/C/D speeds from type + A-speed + speed lookup table
    const margin = rally.speedLimitMarginPercent ?? 10;
    const withSpeeds = recalculateSpeeds(allRows, rally.speedLookupTable, rally.timeAddLookupTable, margin);

    // Step 2: Compute first/last car arrival times
    const sgs = resolveSpeedGroupSettings(day);
    const updatedRows = computeTimes(
      withSpeeds,
      day.startTime,
      sgs,
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

    const lastRow = updatedRows[updatedRows.length - 1];
    return {
      rows: updatedRows.length,
      nodes: day.nodes.length,
      firstCar: lastRow?.firstCarTime ?? '--',
      lastCar: lastRow?.lastCarTime ?? '--',
    };
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

  updateTimeAddLookupTable: (table: TimeAddLookupEntry[]) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        timeAddLookupTable: table,
        modifiedAt: new Date().toISOString(),
      })),
      isDirty: true,
    });
  },

  updateSpeedLimitMargin: (percent: number) => {
    const { workspace, currentRallyId } = get();
    if (!workspace || !currentRallyId) return;
    set({
      workspace: updateRallyV3(workspace, currentRallyId, r => ({
        ...r,
        speedLimitMarginPercent: percent,
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

  setRouteBuilderTab: (tab: 'nodes' | 'table') => {
    set({ routeBuilderTab: tab });
  },

  toggleReconMode: () => {
    set(s => ({ reconMode: !s.reconMode }));
  },

  clearCheckDistances: () => {
    const { workspace, currentRallyId, currentEditionId, currentDayId } = get();
    if (!workspace || !currentRallyId || !currentEditionId || !currentDayId) return;

    const day = get().getCurrentDay();
    if (!day) return;

    const updatedNodes = day.nodes.map(node => ({
      ...node,
      rows: node.rows.map(r => ({ ...r, checkDist: null, checkLat: null, checkLong: null })),
    }));

    set({
      workspace: updateRallyV3(workspace, currentRallyId, r =>
        updateEdition(r, currentEditionId, ed =>
          updateRouteDay(ed, currentDayId, d => ({ ...d, nodes: updatedNodes })),
        ),
      ),
      isDirty: true,
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

// --- Standalone selectors (safe for React useSyncExternalStore) ---
// These use the state parameter `s` directly instead of `get()`, preventing
// infinite re-render loops with Zustand's useSyncExternalStore.
// IMPORTANT: Selectors returning arrays/objects must return stable references
// for empty cases, since Object.is([], []) is false and would cause infinite
// re-renders via useSyncExternalStore.

const EMPTY_ROWS: RouteRow[] = [];

export const selectCurrentRally = (s: ProjectState): RallyV3 | null => {
  if (!s.workspace || !s.currentRallyId) return null;
  return s.workspace.rallies.find(r => r.id === s.currentRallyId) ?? null;
};

export const selectCurrentEdition = (s: ProjectState): RallyEdition | null => {
  const rally = selectCurrentRally(s);
  if (!rally || !s.currentEditionId) return null;
  return rally.editions.find(e => e.id === s.currentEditionId) ?? null;
};

export const selectCurrentDay = (s: ProjectState): RouteDay | null => {
  const edition = selectCurrentEdition(s);
  if (!edition || !s.currentDayId) return null;
  return edition.days.find(d => d.id === s.currentDayId) ?? null;
};

export const selectCurrentNode = (s: ProjectState): RouteNode | null => {
  const day = selectCurrentDay(s);
  if (!day || !s.currentNodeId) return null;
  return day.nodes.find(n => n.id === s.currentNodeId) ?? null;
};

export const selectIsCurrentEditionLocked = (s: ProjectState): boolean => {
  if (!s.workspace || !s.currentRallyId || !s.currentEditionId) return false;
  const rally = s.workspace.rallies.find(r => r.id === s.currentRallyId);
  const edition = rally?.editions.find(e => e.id === s.currentEditionId);
  return edition?.locked === true;
};

/** @deprecated Use selectIsCurrentEditionLocked instead */
export const selectIsCurrentRallyLocked = selectIsCurrentEditionLocked;

export const selectReconMode = (s: ProjectState): boolean => s.reconMode;

export const selectReconTolerance = (s: ProjectState): number => {
  const day = selectCurrentDay(s);
  return day?.reconDistanceTolerance ?? 0.01;
};

export const selectCurrentRows = (s: ProjectState): RouteRow[] => {
  if (s.editingTemplateId && s.workspace && s.currentRallyId) {
    const rally = s.workspace.rallies.find(r => r.id === s.currentRallyId);
    if (rally) {
      const template = rally.nodeLibrary.find(t => t.id === s.editingTemplateId);
      if (template) return template.rows;
    }
    return EMPTY_ROWS;
  }
  const node = selectCurrentNode(s);
  return node?.rows ?? EMPTY_ROWS;
};

/** Find the source template for a given node ID */
export const selectSourceTemplateForNode = (s: ProjectState, nodeId: string): NodeTemplate | null => {
  const rally = selectCurrentRally(s);
  if (!rally) return null;

  const day = selectCurrentDay(s);
  if (!day) return null;

  const node = day.nodes.find(n => n.id === nodeId);
  if (!node || !node.sourceNodeId) return null;

  return rally.nodeLibrary.find(t => t.id === node.sourceNodeId) ?? null;
};

/** Find a node by ID in the current day */
export const selectNodeById = (s: ProjectState, nodeId: string): RouteNode | null => {
  const day = selectCurrentDay(s);
  if (!day) return null;
  return day.nodes.find(n => n.id === nodeId) ?? null;
};
