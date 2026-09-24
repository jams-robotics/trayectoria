import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { degToRad } from '@trayectoria/sim-core';
import { describe, expect, test } from 'vitest';

import { ProjectileWidget } from './ProjectileWidget';
import { flightTime, range, speedAt } from './compute';

/** The value of one row of the values panel, by the text of its term. */
function valueOf(term: string): string {
  const panel = screen.getByTestId('readout-panel');
  return within(panel).getByText(term).nextElementSibling?.textContent ?? '';
}

/** The labels of the sliders of the widget, in order. */
function sliderLabels(): readonly (string | null)[] {
  return screen.getAllByRole('slider').map((slider) => slider.getAttribute('aria-label'));
}

describe('ProjectileWidget (F2-05)', () => {
  test('el modo launch muestra los valores dorados de T-1.4 (4 m/s, 40°, 0.3 m)', () => {
    render(
      <ProjectileWidget
        mode="launch"
        initial={{ v0_mps: 4, launchAngle_rad: degToRad(40), h_m: 0.3 }}
        showVectors={['v', 'vx', 'vy']}
      />,
    );

    expect(valueOf('Alcance')).toBe('1.91 m');
    expect(valueOf('Altura máxima')).toBe('0.637 m');
    expect(valueOf('Tiempo de vuelo')).toBe('0.622 s');
  });

  test('el modo drop muestra el tiempo de caída de T-1.3 desde 0.25 m', () => {
    render(<ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} showVectors={['v']} />);

    expect(valueOf('Tiempo de vuelo')).toBe('0.226 s');
    expect(valueOf('Alcance')).toBe('0.00 m');
    expect(valueOf('Altura máxima')).toBe('0.250 m');
  });

  test('en dropFromRobot el alcance es el adelanto de 0.1355 m de T-1.4', () => {
    render(<ProjectileWidget mode="dropFromRobot" initial={{ vRobot_mps: 0.6, h_m: 0.25 }} />);

    expect(valueOf('Alcance')).toBe('0.135 m');
    expect(valueOf('Tiempo de vuelo')).toBe('0.226 s');
  });

  test('abierto en initialTime_s muestra la posición y las velocidades de ese instante', () => {
    render(
      <ProjectileWidget
        mode="launch"
        initial={{ v0_mps: 4, launchAngle_rad: degToRad(40), h_m: 0.3 }}
        initialTime_s={0.3}
      />,
    );

    // x = 4·cos40°·0.3 = 0.919 m; y = 0.3 + 4·sen40°·0.3 − ½·9.81·0.09 = 0.6299 m.
    expect(valueOf('Tiempo')).toBe('0.300 s');
    expect(valueOf('Posición x')).toBe('0.919 m');
    expect(valueOf('Altura y')).toBe('0.630 m');
    expect(valueOf('Velocidad vx')).toBe('3.06 m/s');
    // vy = 4·sen40° − 9.81·0.3 = −0.372 m/s.
    expect(valueOf('Velocidad vy')).toBe('-0.372 m/s');
  });

  test('cada modo edita sólo sus parámetros, con su unidad', () => {
    const { unmount } = render(
      <ProjectileWidget mode="launch" initial={{ v0_mps: 4, launchAngle_rad: 0.698, h_m: 0.3 }} />,
    );
    expect(sliderLabels()).toEqual([
      'Velocidad inicial en m/s',
      'Ángulo de lanzamiento en °',
      'Altura inicial en m',
    ]);
    unmount();

    const drop = render(<ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} />);
    expect(sliderLabels()).toEqual(['Altura inicial en m']);
    drop.unmount();

    render(<ProjectileWidget mode="dropFromRobot" initial={{ vRobot_mps: 0.6, h_m: 0.25 }} />);
    expect(sliderLabels()).toEqual(['Velocidad del robot en m/s', 'Altura inicial en m']);
  });

  test('subir v0 con el deslizador aumenta el alcance (experimento 1 de T-1.4)', async () => {
    const user = userEvent.setup();
    render(
      <ProjectileWidget mode="launch" initial={{ v0_mps: 4, launchAngle_rad: degToRad(40), h_m: 0 }} />,
    );

    expect(valueOf('Alcance')).toBe('1.61 m');
    const slider = screen.getByRole('slider', { name: 'Velocidad inicial en m/s' });
    slider.focus();
    // Diez pasos de 0.1 m/s llevan v0 de 4 a 5 m/s: R = 5²·sen80°/9.81 = 2.51 m.
    for (let press = 0; press < 10; press++) await user.keyboard('{ArrowRight}');

    expect(valueOf('Alcance')).toBe('2.51 m');
  });

  test('`overlay` añade un segundo lanzamiento con sus propios deslizadores y columna', async () => {
    const user = userEvent.setup();
    render(
      <ProjectileWidget
        mode="launch"
        initial={{ v0_mps: 4, launchAngle_rad: degToRad(40), h_m: 0 }}
        overlay
      />,
    );

    expect(screen.getByText('Lanzamiento A')).toBeInTheDocument();
    expect(screen.getByText('Lanzamiento B')).toBeInTheDocument();
    // Ambas columnas arrancan iguales: el mismo lanzamiento dos veces.
    expect(valueOf('Alcance')).toBe('1.61 m  ·  1.61 m');

    // Experimento 2 de T-1.4: 30° y 60° con h = 0 dan el mismo alcance. Se mueve B a 60°
    // (el segundo deslizador de ángulo) y A a 30°.
    const angles = screen.getAllByRole('slider', { name: 'Ángulo de lanzamiento en °' });
    expect(angles).toHaveLength(2);
    const [angleA, angleB] = angles;
    if (angleA === undefined || angleB === undefined) throw new Error('missing angle sliders');
    angleB.focus();
    for (let press = 0; press < 20; press++) await user.keyboard('{ArrowRight}');
    angleA.focus();
    for (let press = 0; press < 10; press++) await user.keyboard('{ArrowLeft}');

    const [rangeA, rangeB] = valueOf('Alcance').split('  ·  ');
    expect(rangeA).toBe(rangeB);
  });

  test('`overlay` se ignora en dropFromRobot (#304)', () => {
    render(<ProjectileWidget mode="dropFromRobot" initial={{ vRobot_mps: 0.6, h_m: 0.25 }} overlay />);

    expect(screen.queryByText('Lanzamiento A')).not.toBeInTheDocument();
    expect(screen.queryByText('Caída A')).not.toBeInTheDocument();
    expect(valueOf('Tiempo de vuelo')).toBe('0.226 s');
  });

  test('expone los controles de simulación, la escena y una descripción del estado', () => {
    render(
      <ProjectileWidget
        mode="dropFromRobot"
        initial={{ vRobot_mps: 0.6, h_m: 0.25 }}
        showVectors={['v', 'vx', 'vy']}
      />,
    );

    const controls = screen.getByRole('group', { name: 'Controles de simulación' });
    for (const name of ['Reproducir', 'Pausa', 'Paso', 'Reiniciar']) {
      expect(within(controls).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Vista lateral del robot en movimiento que suelta una pieza, con la trayectoria y los vectores de velocidad',
    );
    // El panel de parámetros tiene su propia región viva, así que se busca la del widget.
    const live = screen
      .getAllByRole('status')
      .find((region) => region.textContent?.startsWith('En t'));
    expect(live).toHaveTextContent('En t 0.00 s la pieza está en x 0.00 m y a una altura de 0.250 m');
  });

  test('«Paso» avanza el tiempo y el panel lo sigue', async () => {
    const user = userEvent.setup();
    render(<ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} />);

    expect(valueOf('Tiempo')).toBe('0.00 s');
    await user.click(screen.getByRole('button', { name: 'Paso' }));

    expect(valueOf('Tiempo')).toBe('0.0100 s');
    // y(0.01) = 0.25 − ½·9.81·0.0001 = 0.24951 m.
    expect(valueOf('Altura y')).toBe('0.250 m');
  });
});

describe('ProjectileWidget · dos caídas y selector de modo (#304)', () => {
  test('en drop con overlay, B cae desde 4·h: 0.25 m y 1 m dan 0.2258 s y 0.4515 s', () => {
    // Abierto más allá del final: el tiempo se queda en el aterrizaje de B y A sigue en el suelo.
    render(<ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} overlay initialTime_s={1} />);

    expect(screen.getByText('Caída A')).toBeInTheDocument();
    expect(screen.getByText('Caída B')).toBeInTheDocument();
    expect(valueOf('Altura máxima')).toBe('0.250 m  ·  1.00 m');
    expect(valueOf('Tiempo de vuelo')).toBe('0.226 s  ·  0.452 s');
    expect(valueOf('Tiempo')).toBe('0.452 s  ·  0.452 s');
    // Velocidad de impacto: vy en el aterrizaje de cada caída, −√(2gh).
    expect(valueOf('Altura y')).toBe('0.00 m  ·  0.00 m');
    expect(valueOf('Velocidad vy')).toBe('-2.21 m/s  ·  -4.43 m/s');

    const [a, b] = [0.25, 1].map((h_m) => ({ v0_mps: 0, launchAngle_rad: 0, h_m, vRobot_mps: 0 }));
    if (a === undefined || b === undefined) throw new Error('missing drops');
    expect(flightTime('drop', a)).toBeCloseTo(0.2258, 4);
    expect(flightTime('drop', b)).toBeCloseTo(0.4515, 4);
    expect(speedAt('drop', a, flightTime('drop', a))).toBeCloseTo(2.215, 3);
    expect(speedAt('drop', b, flightTime('drop', b))).toBeCloseTo(4.429, 3);
  });

  test('con modes aparece el selector; «Soltar desde robot» da el adelanto de 0.1355 m', async () => {
    const user = userEvent.setup();
    render(
      <ProjectileWidget
        mode="launch"
        modes={['launch', 'dropFromRobot']}
        initial={{ v0_mps: 4, launchAngle_rad: degToRad(40), h_m: 0.25, vRobot_mps: 0.6 }}
      />,
    );

    const selector = screen.getByRole('group', { name: 'Situación' });
    const buttons = within(selector).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Lanzar', 'Soltar desde robot']);
    expect(within(selector).getByRole('button', { name: 'Lanzar' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(within(selector).getByRole('button', { name: 'Soltar desde robot' }));

    expect(within(selector).getByRole('button', { name: 'Soltar desde robot' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(selector).getByRole('button', { name: 'Lanzar' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(valueOf('Alcance')).toBe('0.135 m');
    expect(
      range('dropFromRobot', { v0_mps: 0, launchAngle_rad: 0, h_m: 0.25, vRobot_mps: 0.6 }),
    ).toBeCloseTo(0.1355, 4);
    expect(sliderLabels()).toEqual(['Velocidad del robot en m/s', 'Altura inicial en m']);
  });

  test('sin modes, o con un solo modo, no hay selector', () => {
    const { unmount } = render(<ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} />);
    expect(screen.queryByRole('group', { name: 'Situación' })).not.toBeInTheDocument();
    unmount();

    render(<ProjectileWidget mode="drop" modes={['drop']} initial={{ h_m: 0.25 }} />);
    expect(screen.queryByRole('group', { name: 'Situación' })).not.toBeInTheDocument();
  });

  test('el selector se opera con teclado', async () => {
    const user = userEvent.setup();
    render(
      <ProjectileWidget
        mode="launch"
        modes={['launch', 'drop', 'dropFromRobot']}
        initial={{ v0_mps: 4, launchAngle_rad: degToRad(40), h_m: 0.25 }}
      />,
    );

    const selector = screen.getByRole('group', { name: 'Situación' });
    const drop = within(selector).getByRole('button', { name: 'Soltar' });
    await user.tab();
    expect(within(selector).getByRole('button', { name: 'Lanzar' })).toHaveFocus();
    await user.tab();
    expect(drop).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(drop).toHaveAttribute('aria-pressed', 'true');
    expect(drop).toHaveFocus();
    expect(valueOf('Tiempo de vuelo')).toBe('0.226 s');

    await user.tab();
    await user.keyboard(' ');
    expect(within(selector).getByRole('button', { name: 'Soltar desde robot' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('cambiar de modo vuelve a t = 0 en pausa y conserva h', async () => {
    const user = userEvent.setup();
    render(
      <ProjectileWidget
        mode="launch"
        modes={['launch', 'drop']}
        initial={{ v0_mps: 4, launchAngle_rad: degToRad(40), h_m: 0.3 }}
        initialTime_s={0.3}
      />,
    );

    const h = screen.getByRole('slider', { name: 'Altura inicial en m' });
    h.focus();
    // Dos pasos de 0.05 m llevan h de 0.3 a 0.4 m.
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await user.click(screen.getByRole('button', { name: 'Soltar' }));

    expect(valueOf('Tiempo')).toBe('0.00 s');
    expect(valueOf('Altura máxima')).toBe('0.400 m');
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lanzar' }));
    expect(valueOf('Tiempo')).toBe('0.00 s');
    expect(sliderLabels()).toContain('Velocidad inicial en m/s');
    // v0 y α también se conservan: H = 0.4 + (4·sen40°)²/(2·9.81) = 0.737 m.
    expect(valueOf('Altura máxima')).toBe('0.737 m');
  });

  test('con overlay, la caída que aterriza antes se queda en el suelo', () => {
    render(<ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} overlay initialTime_s={0.3} />);

    // En t = 0.3 s A ya aterrizó (0.226 s): su altura es 0, no negativa.
    expect(valueOf('Altura y').split('  ·  ')[0]).toBe('0.00 m');
  });
});
