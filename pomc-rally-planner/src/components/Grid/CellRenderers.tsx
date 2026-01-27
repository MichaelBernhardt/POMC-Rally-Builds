import { ICellRendererParams } from 'ag-grid-community';
import { TypeCode, TYPE_CODE_LABELS } from '../../types/domain';

/** Render clue text with {annotations} highlighted */
export function ClueCellRenderer(params: ICellRendererParams) {
  const value = params.value as string;
  if (!value) return null;

  // Split on {curly braces} and render annotations in grey italic
  const parts = value.split(/(\{[^}]*\})/g);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('{') && part.endsWith('}')) {
          return (
            <span key={i} className="clue-annotation">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

/** Render type code with color and full label tooltip */
export function TypeCellRenderer(params: ICellRendererParams) {
  const value = params.value as TypeCode | null;
  if (!value) return null;

  const label = TYPE_CODE_LABELS[value] ?? value;

  return (
    <span
      className={`cell-type-${value}`}
      title={`${value} - ${label}`}
      style={{ cursor: 'default' }}
    >
      {value}
    </span>
  );
}
