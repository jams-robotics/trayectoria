import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Mat4 } from '@trayectoria/sim-core';

import { matrixRows } from './matrices';

// F5-02 (#135, decisión 3): matriz 4×4 en mono alineada a la derecha, 3 decimales, columna de
// traslación en `data-1` y fila inferior `0 0 0 1` en `fg-muted` (docs/DESIGN.md §6). Se pinta
// como `<table>` y no con `Formula`: KaTeX no admite colorear una columna con los tokens de la
// plataforma, y el color de la traslación es parte de la spec de diseño (#135, decisión 1).

/** Índice de la columna de traslación dentro de la matriz homogénea. */
const TRANSLATION_COLUMN = 3;

/** Índice de la fila inferior `0 0 0 1`, que no aporta información al usuario. */
const BOTTOM_ROW = 3;

/** Token de una entrada según su sitio en la matriz (docs/DESIGN.md §6). */
function entryToken(row: number, column: number): string {
  if (row === BOTTOM_ROW) return 'text-fg-muted';
  return column === TRANSLATION_COLUMN ? 'text-data-1' : 'text-fg';
}

export interface MatrixBlockProps {
  /** La matriz a pintar, columna-mayor como el `Mat4` de sim-core. */
  transform: Mat4;
  /** Nombre de la matriz tal cual se muestra (por ejemplo `⁰T_i`). */
  label: string;
  /** Eslabón al que pertenece, para anunciar la tabla. */
  link: string;
}

/** Una matriz homogénea 4×4 del panel de matrices, con los tokens de docs/DESIGN.md §6. */
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
          // Las filas y las columnas de una matriz 4×4 son posiciones fijas, no una lista que
          // se reordene: el índice es la identidad estable de cada celda.
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
