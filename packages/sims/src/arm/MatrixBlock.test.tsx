import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { t } from '@trayectoria/i18n';
import { describe, expect, test } from 'vitest';

import { MatrixBlock } from './MatrixBlock';

// F5-02 (#135, decisión 3): la matriz 4×4 en mono alineada a la derecha, 3 decimales, con la
// columna de traslación en `data-1` y la fila inferior en `fg-muted` (docs/DESIGN.md §6).

/** `⁰T₂` del brazo plano con q = (π/2, −π/2), en columna-mayor como el `Mat4` de sim-core. */
const GOLDEN_T = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0.15, 0.2, 0, 1];

describe('MatrixBlock (F5-02)', () => {
  test('pinta las dieciséis entradas con tres decimales', () => {
    render(<MatrixBlock transform={GOLDEN_T} label="⁰T₂" link="link2" />);
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(16);
    expect(cells.map((cell) => cell.textContent)).toEqual([
      '0.000',
      '-1.000',
      '0.000',
      '0.150',
      '1.000',
      '0.000',
      '0.000',
      '0.200',
      '0.000',
      '0.000',
      '1.000',
      '0.000',
      '0.000',
      '0.000',
      '0.000',
      '1.000',
    ]);
  });

  test('la columna de traslación lleva el token `data-1` y la fila inferior `fg-muted`', () => {
    render(<MatrixBlock transform={GOLDEN_T} label="⁰T₂" link="link2" />);
    const rows = screen.getAllByRole('row');
    const translation = within(rows[0] as HTMLElement).getAllByRole('cell')[3];
    expect(translation).toHaveClass('text-data-1');
    const rotation = within(rows[0] as HTMLElement).getAllByRole('cell')[0];
    expect(rotation).toHaveClass('text-fg');
    for (const cell of within(rows[3] as HTMLElement).getAllByRole('cell')) {
      expect(cell).toHaveClass('text-fg-muted');
    }
  });

  test('normaliza el cero negativo a `0.000`', () => {
    const withNegativeZero = [...GOLDEN_T];
    withNegativeZero[0] = -1e-9;
    render(<MatrixBlock transform={withNegativeZero} label="⁰T₂" link="link2" />);
    expect(screen.getAllByRole('cell')[0]).toHaveTextContent('0.000');
  });

  test('la tabla se anuncia con la matriz y el eslabón, sin literales en el componente', () => {
    render(<MatrixBlock transform={GOLDEN_T} label="⁰T₂" link="link2" />);
    const table = screen.getByRole('table', {
      name: t('sims.matrices.table', { matrix: '⁰T₂', link: 'link2' }),
    });
    expect(table).toBeInTheDocument();
  });

  test('las entradas van en mono con cifras tabulares alineadas a la derecha', () => {
    render(<MatrixBlock transform={GOLDEN_T} label="⁰T₂" link="link2" />);
    const cell = screen.getAllByRole('cell')[0] as HTMLElement;
    expect(cell).toHaveClass('font-mono');
    expect(cell).toHaveClass('tabular-nums');
    expect(cell).toHaveClass('text-right');
  });
});
