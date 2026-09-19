import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { DiffDriveWidget } from './DiffDriveWidget';
import type { DiffDriveShow } from './DiffDriveWidget';

/** The «Explora» of T-5.2: the pair of the hook, 15 and 20 rad/s. */
const T52 = { omegaL_radps: 15, omegaR_radps: 20 } as const;
/** The «Explora» of T-5.3: 0.4 m/s and 1.5 rad/s. */
const T53 = { v_mps: 0.4, omega_radps: 1.5 } as const;
/** Everything the scene can draw, so a test never has to list it again. */
const ALL_SHOW: DiffDriveShow[] = ['icr', 'frames', 'trace', 'radius', 'wheelVelocities'];

/** The value of one row of a values panel, by the text of its term. */
function valueOf(term: string): string {
  const panels = screen.getAllByTestId('readout-panel');
  for (const panel of panels) {
    const dt = within(panel).queryByText(term);
    if (dt !== null) return dt.nextElementSibling?.textContent ?? '';
  }
  return '';
}

/** The slider whose accessible name starts with `label`. */
function sliderFor(label: string): HTMLElement {
  return screen.getByRole('slider', { name: new RegExp(`^${label}`) });
}

/** Writes `value` in the numeric field of the slider named `label` and applies it. */
async function typeValue(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: string,
): Promise<void> {
  const field = screen.getByRole('textbox', { name: new RegExp(label) });
  await user.clear(field);
  await user.type(field, `${value}{Enter}`);
}

describe('DiffDriveWidget (F2-09a)', () => {
  test('ω_L = 15 y ω_R = 20 dan v = 0.56 m/s, ω = 1.067 rad/s y R = 0.525 m (T-5.2)', () => {
    render(<DiffDriveWidget mode="forward" show={ALL_SHOW} initial={T52} />);

    expect(valueOf('Velocidad lineal')).toBe('0.560 m/s');
    expect(valueOf('Velocidad angular')).toBe('1.07 rad/s');
    expect(valueOf('Radio de giro')).toBe('0.525 m');
  });

  test('con ω_L = ω_R el radio es ∞ y la escena no dibuja el CIR (T-5.2)', () => {
    render(
      <DiffDriveWidget
        mode="forward"
        show={ALL_SHOW}
        initial={{ omegaL_radps: 12, omegaR_radps: 12 }}
      />,
    );

    expect(valueOf('Radio de giro')).toBe('∞ (recta)');
    expect(valueOf('Velocidad angular')).toBe('0.00 rad/s');
  });

  test('el pivote con ω_L = 0 deja el CIR sobre la rueda: R = L/2 = 0.075 m (T-5.2)', () => {
    render(
      <DiffDriveWidget
        mode="forward"
        show={['icr', 'radius']}
        initial={{ omegaL_radps: 0, omegaR_radps: 20 }}
      />,
    );

    expect(valueOf('Radio de giro')).toBe('0.0750 m');
  });

  test('el modo inverso deriva ω_L = 8.98 y ω_R = 16.0 rad/s de v = 0.4 y ω = 1.5 (T-5.3)', () => {
    render(<DiffDriveWidget mode="inverse" show={ALL_SHOW} initial={T53} />);

    expect(valueOf('Velocidad angular de la rueda izquierda')).toBe('8.98 rad/s');
    expect(valueOf('Velocidad angular de la rueda derecha')).toBe('16.0 rad/s');
    expect(screen.queryByTestId('diffdrive-notice')).not.toBeInTheDocument();
  });

  test('v = 0.6 y ω = 2 no son realizables y el panel avisa de la saturación (T-5.3)', () => {
    render(<DiffDriveWidget mode="inverse" show={ALL_SHOW} initial={{ v_mps: 0.6, omega_radps: 2 }} />);

    expect(valueOf('Velocidad de la rueda derecha')).toBe('0.750 m/s');
    expect(screen.getByTestId('diffdrive-notice')).toHaveTextContent('supera la velocidad máxima');
  });

  test('el modo directo edita las dos ruedas y el inverso v y ω (#92, decisión 4)', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DiffDriveWidget mode="forward" show={[]} initial={T52} />);

    const omegaR = sliderFor('Velocidad angular de la rueda derecha');
    expect(omegaR).toHaveAttribute('min', '-20.9');
    expect(omegaR).toHaveAttribute('max', '20.9');
    expect(omegaR).toHaveAttribute('step', '0.1');
    await typeValue(user, 'rueda derecha', '15');
    expect(valueOf('Radio de giro')).toBe('∞ (recta)');
    unmount();

    render(<DiffDriveWidget mode="inverse" show={[]} initial={T53} />);
    expect(sliderFor('Velocidad lineal del robot')).toHaveAttribute('max', '0.67');
    expect(sliderFor('Velocidad angular del robot')).toHaveAttribute('max', '5');
  });

  test('con frames el panel muestra los términos de R(θ) y los sensores en {G} (T-5.1)', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="forward" show={['frames']} initial={T52} />);

    // En la pose inicial (0, 0, 0) la matriz es la identidad y el sensor central queda a 0.09 m.
    expect(valueOf('R(θ) fila 1 columna 1')).toBe('1.00');
    expect(valueOf('R(θ) fila 1 columna 2')).toBe('0.00');
    expect(valueOf('Sensor 3 en el marco global')).toBe('(0.0900, 0.00 m)');

    // Con θ = 90° la matriz tiene cos = 0 y sin = 1 (experimento 3 de T-5.1).
    await typeValue(user, 'Orientación del robot', '90');
    expect(valueOf('R(θ) fila 1 columna 1')).toBe('0.00');
    expect(valueOf('R(θ) fila 2 columna 1')).toBe('1.00');
    expect(valueOf('Orientación')).toBe('90.0 °');
    expect(valueOf('Sensor 3 en el marco global')).toBe('(0.00, 0.0900 m)');
  });

  test('el robot se puede arrastrar en pausa para fijar x, y (#92, decisión 6)', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="forward" show={['trace']} initial={T52} />);

    screen.getByRole('button', { name: /Arrastra el robot/ }).focus();
    await user.keyboard('{ArrowRight}{ArrowUp}');
    expect(valueOf('Posición x')).toBe('0.100 m');
    expect(valueOf('Posición y')).toBe('0.100 m');

    await user.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(valueOf('Posición x')).toBe('0.00 m');
    expect(valueOf('Posición y')).toBe('0.00 m');
  });

  test('el modo odometría avisa de que llega en F2-09b y se comporta como directo (decisión 9)', () => {
    render(<DiffDriveWidget mode="odometry" show={ALL_SHOW} initial={T52} />);

    expect(screen.getByTestId('diffdrive-notice')).toHaveTextContent('F2-09b');
    expect(valueOf('Radio de giro')).toBe('0.525 m');
    expect(sliderFor('Velocidad angular de la rueda izquierda')).toBeInTheDocument();
  });

  test('describe el estado en una región aria-live y la escena tiene descripción (a11y)', () => {
    render(<DiffDriveWidget mode="forward" show={ALL_SHOW} initial={T52} />);

    const status = screen
      .getAllByRole('status')
      .find((node) => node.textContent?.startsWith('El robot está en'));
    expect(status).toBeDefined();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('El robot está en (0.00, 0.00 m)');
    expect(status).toHaveTextContent('su radio de giro es 0.525 m');
    expect(screen.getByRole('img', { name: /Robot diferencial sobre el suelo/ })).toBeInTheDocument();
  });

  test('«Paso» avanza la simulación un dt y el reloj lo refleja (#92, decisión 3)', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="forward" show={['trace']} initial={T52} duration_s={1} />);

    await user.click(screen.getByRole('button', { name: 'Paso' }));
    expect(screen.getByTestId('sim-clock')).toHaveTextContent('00.01');
    expect(Number.parseFloat(valueOf('Posición x'))).toBeGreaterThan(0);
  });

  test('la traza se rehace desde cero al reiniciar (#92, decisión 5)', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="forward" show={['trace']} initial={T52} duration_s={1} />);

    for (let click = 0; click < 12; click += 1) {
      await user.click(screen.getByRole('button', { name: 'Paso' }));
    }
    expect(Number.parseFloat(valueOf('Posición x'))).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(screen.getByTestId('sim-clock')).toHaveTextContent('00.00');
    expect(valueOf('Posición x')).toBe('0.00 m');
  });

  test('initialTime_s abre el widget con el robot ya avanzado (#92, decisión 7)', () => {
    render(
      <DiffDriveWidget mode="forward" show={['trace']} initial={T52} initialTime_s={3} />,
    );

    // El modelo de sim-core rampa los comandos a maxAccel_radps2 = 40 rad/s², así que en 3 s el
    // robot ha girado algo menos que los 3.2 rad del régimen permanente, pero ya ha recorrido
    // más de media vuelta del arco de R = 0.525 m.
    expect(valueOf('Orientación en radianes')).toBe('2.74 rad');
    expect(valueOf('Radio de giro')).toBe('0.525 m');
  });
});
