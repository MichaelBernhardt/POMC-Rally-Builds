import {
  RallyWorkspaceV3,
  RallyV3,
  RallyEdition,
  RouteDay,
  RouteNode,
  RouteRow,
} from '../types/domain';

/** Immutably update the rally matching rallyId within a V3 workspace */
export function updateRallyV3(
  workspace: RallyWorkspaceV3,
  rallyId: string,
  updater: (rally: RallyV3) => RallyV3,
): RallyWorkspaceV3 {
  return {
    ...workspace,
    rallies: workspace.rallies.map(r =>
      r.id === rallyId ? updater(r) : r,
    ),
    modifiedAt: new Date().toISOString(),
  };
}

/** Immutably update an edition within a rally */
export function updateEdition(
  rally: RallyV3,
  editionId: string,
  updater: (edition: RallyEdition) => RallyEdition,
): RallyV3 {
  return {
    ...rally,
    editions: rally.editions.map(e =>
      e.id === editionId ? updater(e) : e,
    ),
    modifiedAt: new Date().toISOString(),
  };
}

/** Immutably update a day within an edition */
export function updateRouteDay(
  edition: RallyEdition,
  dayId: string,
  updater: (day: RouteDay) => RouteDay,
): RallyEdition {
  return {
    ...edition,
    days: edition.days.map(d =>
      d.id === dayId ? updater(d) : d,
    ),
  };
}

/** Immutably update a node within a day */
export function updateRouteNode(
  day: RouteDay,
  nodeId: string,
  updater: (node: RouteNode) => RouteNode,
): RouteDay {
  return {
    ...day,
    nodes: day.nodes.map(n =>
      n.id === nodeId ? updater(n) : n,
    ),
  };
}

/** Flatten all nodes' rows within a day into a single ordered array */
export function flattenDayRows(day: RouteDay): RouteRow[] {
  return day.nodes.flatMap(n => n.rows);
}

/** Compute the chaining offset for each node in a day.
 *  Each node's segment-relative distance is rebased so nodes chain
 *  end-to-end. For single-node days starting at km 0, offsets are 0. */
export function computeNodeOffsets(day: RouteDay): number[] {
  const offsets: number[] = [];
  let cumulativeEnd = 0;
  for (const node of day.nodes) {
    if (node.rows.length === 0) {
      offsets.push(cumulativeEnd);
      continue;
    }
    const nodeStart = node.rows[0].rallyDistance;
    offsets.push(cumulativeEnd - nodeStart);
    const nodeEnd = node.rows[node.rows.length - 1].rallyDistance;
    cumulativeEnd = cumulativeEnd + (nodeEnd - nodeStart);
  }
  return offsets;
}

/** Flatten day rows with chained absolute distances.
 *  Each node is rebased so distances chain continuously across nodes. */
export function flattenDayRowsChained(day: RouteDay): RouteRow[] {
  const offsets = computeNodeOffsets(day);
  return day.nodes.flatMap((node, i) =>
    node.rows.map(r => ({
      ...r,
      rallyDistance: Math.round((r.rallyDistance + offsets[i]) * 100) / 100,
    }))
  );
}

/**
 * Find which node contains a given flattened row index.
 * Returns the node index and the local row index within that node.
 */
export function findNodeForFlatIndex(
  day: RouteDay,
  flatIndex: number,
): { nodeIndex: number; localIndex: number } | null {
  let offset = 0;
  for (let i = 0; i < day.nodes.length; i++) {
    const node = day.nodes[i];
    if (flatIndex < offset + node.rows.length) {
      return { nodeIndex: i, localIndex: flatIndex - offset };
    }
    offset += node.rows.length;
  }
  return null;
}

/** Deep-update helper: workspace -> rally -> edition -> day -> node -> rows */
export function setNodeRows(
  workspace: RallyWorkspaceV3,
  rallyId: string,
  editionId: string,
  dayId: string,
  nodeId: string,
  rows: RouteRow[],
): RallyWorkspaceV3 {
  return updateRallyV3(workspace, rallyId, rally =>
    updateEdition(rally, editionId, edition =>
      updateRouteDay(edition, dayId, day =>
        updateRouteNode(day, nodeId, node => ({
          ...node,
          rows,
        })),
      ),
    ),
  );
}
