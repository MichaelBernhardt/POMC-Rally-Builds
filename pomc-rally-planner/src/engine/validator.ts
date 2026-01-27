import { RouteRow } from '../types/domain';

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
