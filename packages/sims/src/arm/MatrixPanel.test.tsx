import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@trayectoria/i18n';
import type { ArmSpec } from '@trayectoria/robot-spec';
import { describe, expect, test, vi } from 'vitest';

import { MatrixPanel, chainLatex, matrixLabel } from './MatrixPanel';
import { linkTransforms } from './matrices';

// F5-02 (#135, decisions 1, 3, 6 and 7): link and matrix chips, chain in `Formula` and the
// chosen matrix in `MatrixBlock`. The numbers always come from `matrices.ts`, never from three.

/** 2-DOF planar arm from the catalog (docs/ROBOT-SPEC.md §4). */
const PLANAR_2DOF: ArmSpec = {
  baseLink: 'base_link',
  endEffectorLink: 'tool0',
  links: [{ name: 'base_link' }, { name: 'link1' }, { name: 'link2' }, { name: 'tool0' }],
  joints: [
    {
      name: 'joint1',
      type: 'revolute',
      parent: 'base_link',
      child: 'link1',
      origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
      axis: [0, 0, 1],
      limits: { lower: -Math.PI, upper: Math.PI },
    },
    {
      name: 'joint2',
      type: 'revolute',
      parent: 'link1',
      child: 'link2',
      origin: { xyz: [0.2, 0, 0], rpy: [0, 0, 0] },
      axis: [0, 0, 1],
      limits: { lower: -Math.PI, upper: Math.PI },
    },
  ],
};

/** The panel with the ticket's golden configuration and a spy on the highlighted link. */
function renderPanel(q_rad: readonly number[] = [Math.PI / 2, 0]): {
  onHighlight: ReturnType<typeof vi.fn>;
} {
  const onHighlight = vi.fn();
  render(<MatrixPanel rows={linkTransforms(PLANAR_2DOF, q_rad)} onHighlightLink={onHighlight} />);
  return { onHighlight };
}

/** The chips of a group, by their accessible label. */
function chipsOf(label: string): HTMLElement[] {
  return within(screen.getByRole('radiogroup', { name: label })).getAllByRole('radio');
}

describe('MatrixPanel (F5-02)', () => {
  test('ofrece un chip por eslabón de la cadena y tres de matriz', () => {
    renderPanel();
    expect(chipsOf(t('sims.matrices.links')).map((chip) => chip.textContent)).toEqual([
      'base_link',
      'link1',
      'link2',
    ]);
    // The cumulative one carries the index of the chosen link, which starts at the last one (`link2`).
    expect(chipsOf(t('sims.matrices.matrix')).map((chip) => chip.textContent)).toEqual([
      t('sims.matrices.originShort'),
      t('sims.matrices.jointShort'),
      '⁰T₂',
    ]);
  });

  test('arranca en el último eslabón y en la acumulada', () => {
    renderPanel();
    expect(chipsOf(t('sims.matrices.links'))[2]).toHaveAttribute('aria-pressed', 'true');
    expect(chipsOf(t('sims.matrices.matrix'))[2]).toHaveAttribute('aria-pressed', 'true');
  });

  test('con q₁ = 90° y q₂ = 0 la acumulada del eslabón 2 traslada (0.000, 0.200, 0.000)', () => {
    renderPanel();
    const cells = screen.getAllByRole('cell');
    // Translation column of the first three rows: indices 3, 7 and 11 of the sixteen.
    expect(cells[3]).toHaveTextContent('0.000');
    expect(cells[7]).toHaveTextContent('0.200');
    expect(cells[11]).toHaveTextContent('0.000');
  });

  test('cambiar el chip de matriz cambia la matriz mostrada', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(chipsOf(t('sims.matrices.matrix'))[0] as HTMLElement);

    expect(chipsOf(t('sims.matrices.matrix'))[0]).toHaveAttribute('aria-pressed', 'true');
    // `T_origin` of joint2 translates (0.20, 0, 0): the first row of the translation column.
    expect(screen.getAllByRole('cell')[3]).toHaveTextContent('0.200');
  });

  test('cambiar el chip de eslabón cambia la matriz y avisa del resaltado en 3D', async () => {
    const user = userEvent.setup();
    const { onHighlight } = renderPanel();

    await user.click(chipsOf(t('sims.matrices.links'))[1] as HTMLElement);

    expect(onHighlight).toHaveBeenLastCalledWith('link1');
    // `⁰T₁` with q₁ = 90° does not translate: the frame of link1 is at the origin.
    const cells = screen.getAllByRole('cell');
    expect(cells[3]).toHaveTextContent('0.000');
    expect(cells[7]).toHaveTextContent('0.000');
  });

  test('los chips se recorren con el tabulador y se activan con el teclado', async () => {
    const user = userEvent.setup();
    renderPanel();
    const chips = chipsOf(t('sims.matrices.links'));

    (chips[0] as HTMLElement).focus();
    expect(chips[0]).toHaveFocus();
    await user.tab();
    expect(chips[1]).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(chipsOf(t('sims.matrices.links'))[1]).toHaveAttribute('aria-pressed', 'true');
  });

  test('anuncia la matriz visible en una región viva, sin literales en el componente', () => {
    renderPanel();
    const live = screen.getByTestId('matrix-panel-live');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live.textContent).toContain('link2');
  });
});

describe('chainLatex (F5-02)', () => {
  test('encadena las transformaciones de la base al último eslabón', () => {
    expect(chainLatex(2)).toBe('{}^{0}T_{2} = {}^{0}T_{1} \\cdot {}^{1}T_{2}');
  });

  test('un solo eslabón es la identidad de la cadena', () => {
    expect(chainLatex(1)).toBe('{}^{0}T_{1} = {}^{0}T_{1}');
  });

  test('sin eslabones actuados no hay cadena que mostrar', () => {
    expect(chainLatex(0)).toBeNull();
  });
});

describe('matrixLabel (F5-02)', () => {
  test('numera la acumulada con el índice del eslabón', () => {
    expect(matrixLabel('cumulative', 2, t)).toBe('⁰T₂');
  });
});
