import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

/**
 * Advances the simulation `steps` explicit steps of «Paso», one render per step, with no wait
 * on the wall clock (#258). The button is looked up once and clicked with `fireEvent`: the
 * pointer sequence of `userEvent` and a role query per click cost about 60 ms each, which is
 * what pushed the long runs over the timeout. Each step still goes through its own render, so
 * the odometry integrates the encoders once per step as it does in the widget.
 */
function stepSimulation(steps: number): void {
  const button = screen.getByRole('button', { name: 'Paso' });
  for (let step = 0; step < steps; step += 1) fireEvent.click(button);
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
    render(
      <DiffDriveWidget mode="inverse" show={ALL_SHOW} initial={{ v_mps: 0.6, omega_radps: 2 }} />,
    );

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
    await typeValue(user, 'Orientación inicial', '90');
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

  test('describe el estado en una región aria-live y la escena tiene descripción (a11y)', () => {
    render(<DiffDriveWidget mode="forward" show={ALL_SHOW} initial={T52} />);

    const status = screen
      .getAllByRole('status')
      .find((node) => node.textContent?.startsWith('El robot está en'));
    expect(status).toBeDefined();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('El robot está en (0.00, 0.00 m)');
    expect(status).toHaveTextContent('su radio de giro es 0.525 m');
    expect(
      screen.getByRole('img', { name: /Robot diferencial sobre el suelo/ }),
    ).toBeInTheDocument();
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

    stepSimulation(12);
    expect(Number.parseFloat(valueOf('Posición x'))).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(screen.getByTestId('sim-clock')).toHaveTextContent('00.00');
    expect(valueOf('Posición x')).toBe('0.00 m');
  });

  test('initialTime_s abre el widget con el robot ya avanzado (#92, decisión 7)', () => {
    render(<DiffDriveWidget mode="forward" show={['trace']} initial={T52} initialTime_s={3} />);

    // El modelo de sim-core rampa los comandos a maxAccel_radps2 = 40 rad/s², así que en 3 s el
    // robot ha girado algo menos que los 3.2 rad del régimen permanente, pero ya ha recorrido
    // más de media vuelta del arco de R = 0.525 m.
    expect(valueOf('Orientación en radianes')).toBe('2.74 rad');
    expect(valueOf('Radio de giro')).toBe('0.525 m');
  });
});

/** The «Explora» of T-5.4: 12 and 13 rad/s for 20 s. */
const T54 = { omegaL_radps: 12, omegaR_radps: 13 } as const;

describe('DiffDriveWidget odometría (F2-09b)', () => {
  test('el modo odometría abre con la calibración real del perfil (#93, decisión 3)', () => {
    render(<DiffDriveWidget mode="odometry" show={['trace', 'frames']} initial={T54} />);

    expect(sliderFor('Ticks por vuelta de rueda')).toHaveAttribute('min', '16');
    expect(sliderFor('Ticks por vuelta de rueda')).toHaveAttribute('max', '4096');
    expect(sliderFor('Ticks por vuelta de rueda')).toHaveValue('360');
    expect(sliderFor('Radio de rueda creído')).toHaveValue('0.032');
    expect(sliderFor('Radio de rueda creído')).toHaveAttribute('step', '0.0005');
    expect(sliderFor('Distancia entre ruedas creída')).toHaveValue('0.15');
    expect(screen.queryByTestId('diffdrive-notice')).not.toBeInTheDocument();
  });

  test('en t = 0 la pose estimada está en el origen y los errores son nulos (T-5.4)', () => {
    render(<DiffDriveWidget mode="odometry" show={['trace']} initial={T54} duration_s={20} />);

    expect(valueOf('Posición x estimada')).toBe('0.00 m');
    expect(valueOf('Orientación estimada')).toBe('0.00 °');
    expect(valueOf('Error de posición')).toBe('0.00 m');
    expect(valueOf('Error de rumbo')).toBe('0.00 °');
    expect(valueOf('Avance del paso Δs')).toBe('0.00 m');
  });

  test('con la calibración exacta la estimación sigue a la real tras varios pasos', () => {
    render(<DiffDriveWidget mode="odometry" show={['trace']} initial={T54} duration_s={20} />);

    stepSimulation(30);
    expect(Number.parseFloat(valueOf('Posición x estimada'))).toBeGreaterThan(0);
    // La cuantización de 360 ticks por vuelta deja un error de milímetros, no de centímetros.
    expect(Number.parseFloat(valueOf('Error de posición'))).toBeLessThan(0.01);
  });

  test('un radio creído mayor adelanta la pose estimada y el error crece (experimento 2)', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="odometry" show={['trace']} initial={T54} duration_s={20} />);

    await typeValue(user, 'Radio de rueda creído', '0.04');
    stepSimulation(30);
    expect(Number.parseFloat(valueOf('Posición x estimada'))).toBeGreaterThan(
      Number.parseFloat(valueOf('Posición x')),
    );
    expect(Number.parseFloat(valueOf('Error de posición'))).toBeGreaterThan(0.01);
  });

  test('una L creída distinta desvía el rumbo estimado (experimento 3)', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="odometry" show={['trace']} initial={T54} duration_s={20} />);

    await typeValue(user, 'Distancia entre ruedas creída', '0.2');
    stepSimulation(40);
    // Con L creída 0.2 en vez de 0.15 el Δθ estimado es tres cuartos del real, así que el rumbo
    // estimado se queda corto desde el primer paso y el error solo crece mientras el robot gire.
    // El signo es lo que prueba la desviación: el margen exacto depende de cuánto haya avanzado
    // la simulación, que no es lo que este caso comprueba.
    expect(Number.parseFloat(valueOf('Error de rumbo'))).toBeLessThan(0);
    expect(Math.abs(Number.parseFloat(valueOf('Error de rumbo')))).toBeGreaterThan(
      Math.abs(Number.parseFloat(valueOf('Error de posición'))),
    );
  });

  test('initialTime_s abre la odometría con su traza ya recorrida (#93, decisión 4)', () => {
    render(
      <DiffDriveWidget
        mode="odometry"
        show={['trace', 'frames']}
        initial={T54}
        duration_s={20}
        initialTime_s={10}
      />,
    );

    // A los 10 s el robot lleva recorridos unos 4 m, y la estimación con la calibración exacta
    // los sigue: ambas x son del mismo orden y el error queda en milímetros.
    expect(Number.parseFloat(valueOf('Posición x estimada'))).not.toBe(0);
    expect(Number.parseFloat(valueOf('Error de posición'))).toBeLessThan(0.01);
    // Los ticks se muestran como «(izquierda, derecha ticks)» y a los 10 s ya son millares.
    expect(valueOf('Ticks acumulados (izquierda, derecha)')).toMatch(/^\(\d{4}, \d{4} ticks\)$/);
  });

  test('«Reiniciar» devuelve la pose estimada al origen (#93, decisión 3)', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="odometry" show={['trace']} initial={T54} duration_s={20} />);

    stepSimulation(20);
    expect(Number.parseFloat(valueOf('Posición x estimada'))).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(valueOf('Posición x estimada')).toBe('0.00 m');
    expect(valueOf('Error de posición')).toBe('0.00 m');
  });

  test('la escena y la región aria-live describen las dos poses (a11y)', () => {
    render(<DiffDriveWidget mode="odometry" show={['trace', 'frames']} initial={T54} />);

    expect(
      screen.getByRole('img', { name: /pose real y su traza y la pose y la traza estimadas/ }),
    ).toBeInTheDocument();
    const status = screen
      .getAllByRole('status')
      .find((node) => node.textContent?.startsWith('La pose estimada es'));
    expect(status).toBeDefined();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('el error de posición es 0.00 m');
  });
});

describe('DiffDriveWidget orientación inicial θ₀ (#370)', () => {
  test('el slider se etiqueta «Orientación inicial» y abre en 0°', () => {
    render(<DiffDriveWidget mode="forward" show={['trace']} initial={T52} />);

    expect(sliderFor('Orientación inicial')).toHaveValue('0');
  });

  test('al avanzar el robot parte de θ₀ = 90° y no vuelve a 0°', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="forward" show={['trace']} initial={T52} />);

    await typeValue(user, 'Orientación inicial', '90');
    stepSimulation(30);
    // Heading 90°, the robot advances along +y; before #370 the first step dropped θ₀ and it
    // advanced along +x from 0°.
    expect(valueOf('Posición x')).toBe('0.00 m');
    expect(valueOf('Posición y')).toBe('0.0595 m');
    expect(valueOf('Orientación')).toBe('90.0 °');
    expect(sliderFor('Orientación inicial')).toHaveValue('90');
  });

  test('«Reiniciar» devuelve el robot a θ₀', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="forward" show={['trace']} initial={T52} />);

    await typeValue(user, 'Orientación inicial', '90');
    stepSimulation(20);
    await user.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(valueOf('Orientación')).toBe('90.0 °');
    expect(valueOf('Posición x')).toBe('0.00 m');
  });

  test('mientras corre el slider queda deshabilitado y sigue mostrando θ₀', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="forward" show={['trace']} initial={T52} />);

    await typeValue(user, 'Orientación inicial', '45');
    await user.click(screen.getByRole('button', { name: 'Reproducir' }));
    expect(sliderFor('Orientación inicial')).toBeDisabled();
    expect(sliderFor('Orientación inicial')).toHaveValue('45');
  });

  test('en odometría la estimación parte de θ₀ y el error de rumbo es nulo', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="odometry" show={['trace']} initial={T54} duration_s={20} />);

    await typeValue(user, 'Orientación inicial', '90');
    expect(valueOf('Orientación estimada')).toBe('90.0 °');
    expect(valueOf('Error de rumbo')).toBe('0.00 °');
    stepSimulation(10);
    expect(Number.parseFloat(valueOf('Orientación estimada'))).toBeGreaterThan(89);
    expect(Number.parseFloat(valueOf('Error de rumbo'))).toBeLessThan(1);
  });
});
