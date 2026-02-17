import { RouteRow, RouteNode, NodeTemplate } from '../types/domain';

export interface TemplateWarning {
  field: string;
  message: string;
}

/**
 * Check if a template is complete and ready to be placed in routes.
 * A template must have:
 * 1. A non-default name
 * 2. Either isStartNode=true OR exactly one allowedPreviousNode (mutually exclusive)
 */
export function validateTemplate(template: NodeTemplate): TemplateWarning[] {
  const warnings: TemplateWarning[] = [];

  if (!template.name.trim() || template.name.trim() === 'New Node') {
    warnings.push({ field: 'name', message: 'Node must be named' });
  }

  if (!template.isStartNode && template.allowedPreviousNodes.length === 0) {
    warnings.push({
      field: 'connection',
      message: 'Must be a start node or follow another node',
    });
  }

  return warnings;
}

/** Returns true if the template has no validation warnings */
export function isTemplateComplete(template: NodeTemplate): boolean {
  return validateTemplate(template).length === 0;
}

export interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate all rows and return any errors/warnings.
 */
export function validateRows(rows: RouteRow[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Check monotonic distances
    if (i > 0 && row.rallyDistance < rows[i - 1].rallyDistance) {
      errors.push({
        rowIndex: i,
        field: 'rallyDistance',
        message: `Distance ${row.rallyDistance} is less than previous row (${rows[i - 1].rallyDistance})`,
        severity: 'error',
      });
    }

    // Check marked controls have GPS
    if (row.type === 'm') {
      if (row.lat === 0 && row.long === 0) {
        errors.push({
          rowIndex: i,
          field: 'lat',
          message: 'Marked control is missing GPS coordinates',
          severity: 'warning',
        });
      }
    }

    // Check time add rows have addTime values
    if (row.type === 't') {
      if (row.addTimeA === 0 && row.addTimeB === 0 && row.addTimeC === 0 && row.addTimeD === 0) {
        errors.push({
          rowIndex: i,
          field: 'addTimeA',
          message: 'Time add row has no add-time values',
          severity: 'warning',
        });
      }
    }

    // Check rows with type have speed values (except 't')
    if (row.type !== null && row.type !== 't' && row.type !== 'm') {
      if (row.aSpeed <= 0) {
        errors.push({
          rowIndex: i,
          field: 'aSpeed',
          message: 'Row has type but zero A-speed',
          severity: 'warning',
        });
      }
    }

    // Check speed doesn't exceed limit
    if (row.type !== null && row.type !== 't') {
      if (row.speedLimit > 0) {
        if (row.aSpeed > row.speedLimit) {
          errors.push({
            rowIndex: i,
            field: 'aSpeed',
            message: `A-speed (${row.aSpeed}) exceeds speed limit (${row.speedLimit})`,
            severity: 'warning',
          });
        }
        if (row.bSpeed > row.speedLimit) {
          errors.push({
            rowIndex: i,
            field: 'bSpeed',
            message: `B-speed (${row.bSpeed}) exceeds speed limit (${row.speedLimit})`,
            severity: 'warning',
          });
        }
        if (row.cSpeed > row.speedLimit) {
          errors.push({
            rowIndex: i,
            field: 'cSpeed',
            message: `C-speed (${row.cSpeed}) exceeds speed limit (${row.speedLimit})`,
            severity: 'warning',
          });
        }
        if (row.dSpeed > row.speedLimit) {
          errors.push({
            rowIndex: i,
            field: 'dSpeed',
            message: `D-speed (${row.dSpeed}) exceeds speed limit (${row.speedLimit})`,
            severity: 'warning',
          });
        }
      }
    }

    // Check clue is not empty for exported rows
    if (row.type !== null && !row.clue.trim()) {
      errors.push({
        rowIndex: i,
        field: 'clue',
        message: 'Exported row has empty instruction text',
        severity: 'warning',
      });
    }
  }

  return errors;
}

export interface NodeConnectionError {
  nodeIndex: number;
  message: string;
}

/**
 * Validate connections between placed nodes based on their templates'
 * allowedPreviousNodes rules.
 *
 * If a node's template has a non-empty allowedPreviousNodes list, the
 * preceding node's sourceNodeId must appear in that list.
 */
export function validateNodeConnections(
  nodes: RouteNode[],
  nodeLibrary: NodeTemplate[],
): NodeConnectionError[] {
  const errors: NodeConnectionError[] = [];
  const hasAnyStartTemplates = nodeLibrary.some(t => t.isStartNode);

  // Check first node is a valid start node
  if (nodes.length > 0 && hasAnyStartTemplates) {
    const firstNode = nodes[0];
    const firstTemplate = nodeLibrary.find(t => t.id === firstNode.sourceNodeId);
    if (firstTemplate && !firstTemplate.isStartNode) {
      errors.push({
        nodeIndex: 0,
        message: `"${firstTemplate.name}" is not a start node`,
      });
    }
  }

  for (let i = 1; i < nodes.length; i++) {
    const currentNode = nodes[i];
    const prevNode = nodes[i - 1];

    // Find the template for the current node
    const template = nodeLibrary.find(t => t.id === currentNode.sourceNodeId);
    if (!template) continue;
    if (template.allowedPreviousNodes.length === 0) continue;

    // Check if the previous node's source is in the allowed list
    if (!template.allowedPreviousNodes.includes(prevNode.sourceNodeId)) {
      const expectedNames = template.allowedPreviousNodes
        .map(id => nodeLibrary.find(t => t.id === id)?.name ?? '?')
        .map(n => `"${n}"`)
        .join(' or ');
      errors.push({
        nodeIndex: i,
        message: `"${template.name}" must follow ${expectedNames}`,
      });
    }
  }

  return errors;
}
