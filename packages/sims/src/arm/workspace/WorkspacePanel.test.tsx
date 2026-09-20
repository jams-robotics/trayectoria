import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@trayectoria/i18n';
import type { ArmSpec } from '@trayectoria/robot-spec';
import { describe, expect, test, vi } from 'vitest';

import { N_DEFAULT, N_MAX, N_MIN, WorkspacePanel, clampCount } from './WorkspacePanel';
import type { WorkspaceState } from './WorkspacePanel';

// F5-03 (#136, decisiones 4 y 6): el panel con el planificador síncrono, de modo que el
// muestreo termina dentro del propio `await` de la interacción. Ningún literal en español vive
// en el componente: aquí se comprueba contra las claves `sims.workspace.*`.

/** Brazo plano de 2 GDL del catálogo (docs/ROBOT-SPEC.md §4). */
const PLANAR_2DOF: ArmSpec = {
  baseLink: 'base_link',
  endEffectorLink: 'tool0',
  links: [{ name: 'base_link' }, { name: 'link1' }, { name: 'tool0' }],
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
      name: 'tool',
      type: 'fixed',
      parent: 'link1',
      child: 'tool0',
      origin: { xyz: [0.2, 0, 0], rpy: [0, 0, 0] },
      axis: [1, 0, 0],
    },
  ],
};

/** Planificador síncrono: el lote corre en el acto, sin ceder el hilo. */
function immediateSchedule(run: () => void): () => void {
  run();
  return () => undefined;
}

/** El panel montado con el planificador síncrono y un espía de `onChange`. */
function renderPanel(schedule = immediateSchedule): {
  onChange: ReturnType<typeof vi.fn>;
  user: ReturnType<typeof userEvent.setup>;
} {
  const onChange = vi.fn<(state: WorkspaceState) => void>();
  render(<WorkspacePanel arm={PLANAR_2DOF} onChange={onChange} schedule={schedule} />);
  return { onChange, user: userEvent.setup() };
}

/** El campo numérico `n`. */
function countField(): HTMLInputElement {
  return screen.getByLabelText(t('sims.workspace.count'));
}

/** El botón que lanza o cancela el cálculo. */
function computeButton(): HTMLElement {
  return screen.getByTestId('workspace-compute');
}

describe('WorkspacePanel (F5-03)', () => {
  test('arranca sin nube, con n por defecto y sin barra de progreso', () => {
    renderPanel();

    expect(countField()).toHaveValue(N_DEFAULT);
    expect(computeButton()).toHaveTextContent(t('sims.workspace.compute'));
    expect(screen.queryByTestId('workspace-progress')).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-status')).toHaveTextContent(t('sims.workspace.empty'));
    expect(screen.getByTestId('workspace-visibility')).toBeDisabled();
  });

  test('calcular entrega la nube con tres coordenadas por muestra', async () => {
    const { onChange, user } = renderPanel();
    await user.clear(countField());
    await user.type(countField(), '2000');
    await user.click(computeButton());

    const state = onChange.mock.calls.at(-1)?.[0] as WorkspaceState;
    expect(state.points).toHaveLength(3 * 2_000);
    expect(state.visible).toBe(true);
    expect(screen.getByTestId('workspace-status')).toHaveTextContent(
      t('sims.workspace.ready', { count: '2000' }),
    );
  });

  test('el toggle oculta y vuelve a mostrar la nube sin recalcularla', async () => {
    const { onChange, user } = renderPanel();
    await user.clear(countField());
    await user.type(countField(), '200');
    await user.click(computeButton());
    const computed = (onChange.mock.calls.at(-1)?.[0] as WorkspaceState).points;

    const toggle = screen.getByTestId('workspace-visibility');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveTextContent(t('sims.workspace.show'));
    const hidden = onChange.mock.calls.at(-1)?.[0] as WorkspaceState;
    expect(hidden.visible).toBe(false);
    // La misma nube: ocultar no vuelve a muestrear.
    expect(hidden.points).toBe(computed);

    await user.click(toggle);
    expect((onChange.mock.calls.at(-1)?.[0] as WorkspaceState).visible).toBe(true);
  });

  test('durante el cálculo el botón pasa a Cancelar y se ve la barra con su cifra', async () => {
    let pending: (() => void) | null = null;
    const manual = (run: () => void): (() => void) => {
      pending = run;
      return () => {
        pending = null;
      };
    };
    const { onChange, user } = renderPanel(manual);
    await user.clear(countField());
    await user.type(countField(), '4000');
    await user.click(computeButton());

    // Un lote de 1 000 sobre 4 000 muestras: la barra marca el 25 %.
    act(() => {
      const next = pending;
      pending = null;
      next?.();
    });

    expect(computeButton()).toHaveTextContent(t('sims.workspace.cancel'));
    expect(screen.getByTestId('workspace-progress')).toHaveTextContent('25 %');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
    expect(countField()).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('cancelar a mitad detiene el cálculo y no entrega ninguna nube', async () => {
    let pending: (() => void) | null = null;
    const manual = (run: () => void): (() => void) => {
      pending = run;
      return () => {
        pending = null;
      };
    };
    const { onChange, user } = renderPanel(manual);
    await user.clear(countField());
    await user.type(countField(), '4000');
    await user.click(computeButton());
    act(() => {
      const next = pending;
      pending = null;
      next?.();
    });

    await user.click(computeButton());

    expect(computeButton()).toHaveTextContent(t('sims.workspace.compute'));
    expect(screen.queryByTestId('workspace-progress')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(pending).toBeNull();
  });

  test('un n fuera de los límites se recorta al pulsar Calcular', async () => {
    const { user } = renderPanel();
    await user.clear(countField());
    await user.type(countField(), '10');
    await user.click(computeButton());

    expect(countField()).toHaveValue(N_MIN);
  });

  test('clampCount recorta a los límites del campo', () => {
    expect(clampCount(0)).toBe(N_MIN);
    expect(clampCount(1e9)).toBe(N_MAX);
    expect(clampCount(Number.NaN)).toBe(N_DEFAULT);
    expect(clampCount(1234.6)).toBe(1235);
  });
});
