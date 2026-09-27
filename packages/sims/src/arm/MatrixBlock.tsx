import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Mat4 } from '@trayectoria/sim-core';

import { matrixRows } from './matrices';

// F5-02 (#135, decision 3): 4×4 matrix in mono, right-aligned, 3 decimals, translation
// column in `data-1` and bottom row `0 0 0 1` in `fg-muted` (docs/DESIGN.md §6). It is rendered
// as a `<table>` and not with `Formula`: KaTeX cannot colour a column with the platform
// tokens, and the colour of the translation is part of the design spec (#135, decision 1).

/** Index of the translation column within the homogeneous matrix. */
const TRANSLATION_COLUMN = 3;

/** Index of the bottom row `0 0 0 1`, which gives the user no information. */
const BOTTOM_ROW = 3;

/** Token of an entry according to its place in the matrix (docs/DESIGN.md §6). */
function entryToken(row: number, column: number): string {
  if (row === BOTTOM_ROW) return 'text-fg-muted';
  return column === TRANSLATION_COLUMN ? 'text-data-1' : 'text-fg';
}

export interface MatrixBlockProps {
  /** The matrix to render, column-major like the sim-core `Mat4`. */
  transform: Mat4;
  /** Name of the matrix exactly as displayed (for example `⁰T_i`). */
  label: string;
  /** Link it belongs to, to announce the table. */
  link: string;
}

/** A 4×4 homogeneous matrix of the matrix panel, with the tokens of docs/DESIGN.md §6. */
export function MatrixBlock({ transform, label, link }: MatrixBlockProps): JSX.Element {
  const t = useT();
  const rows = matrixRows(transform);
  return (
    <table
      className="border-border bg-bg-raised w-full table-fixed rounded-lg border p-2"
      aria-label={t('sims.matrices.table', { matrix: label, link })}
      data-testid="matrix-block"
    >
      <tbody>
        {rows.map((cells, row) => (
          // The rows and columns of a 4×4 matrix are fixed positions, not a list that
          // gets reordered: the index is the stable identity of each cell.
          <tr key={`row-${String(row)}`}>
            {cells.map((value, column) => (
              <td
                key={`cell-${String(column)}`}
                className={`${entryToken(row, column)} px-2 py-1 text-right font-mono text-xs tabular-nums`}
              >
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
