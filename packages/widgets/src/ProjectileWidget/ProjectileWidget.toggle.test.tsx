import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { degToRad } from '@trayectoria/sim-core';
import { describe, expect, test } from 'vitest';

import { ProjectileWidget } from './ProjectileWidget';

/** The value of one row of the values panel, by the text of its term. */
function valueOf(term: string): string {
  const panel = screen.getByTestId('readout-panel');
  return within(panel).getByText(term).nextElementSibling?.textContent ?? '';
}

const LAUNCH = { v0_mps: 4, launchAngle_rad: degToRad(40), h_m: 0 };

describe('ProjectileWidget · conmutador de B (#361)', () => {
  test('con overlay en launch, «Mostrar lanzamiento B» arranca pulsado y B visible', () => {
    render(<ProjectileWidget mode="launch" initial={LAUNCH} overlay />);

    const toggle = screen.getByRole('button', { name: 'Mostrar lanzamiento B' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Lanzamiento B')).toBeInTheDocument();
    expect(valueOf('Alcance')).toBe('1.61 m  ·  1.61 m');
  });

  test('ocultar B quita su panel y su columna; mostrarlo conserva sus valores', async () => {
    const user = userEvent.setup();
    render(<ProjectileWidget mode="launch" initial={LAUNCH} overlay />);
    const angleB = screen.getAllByRole('slider', { name: 'Ángulo de lanzamiento en °' })[1];
    if (angleB === undefined) throw new Error('missing slider of B');
    angleB.focus();
    for (let press = 0; press < 20; press++) await user.keyboard('{ArrowRight}');
    const rangeB = valueOf('Alcance').split('  ·  ')[1];

    const toggle = screen.getByRole('button', { name: 'Mostrar lanzamiento B' });
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Lanzamiento B')).not.toBeInTheDocument();
    expect(screen.getAllByRole('slider', { name: 'Ángulo de lanzamiento en °' })).toHaveLength(1);
    expect(valueOf('Alcance')).toBe('1.61 m');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(valueOf('Alcance').split('  ·  ')[1]).toBe(rangeB);
  });

  test('`initialShowOverlay={false}` abre con B oculto', () => {
    render(<ProjectileWidget mode="launch" initial={LAUNCH} overlay initialShowOverlay={false} />);

    expect(screen.getByRole('button', { name: 'Mostrar lanzamiento B' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByText('Lanzamiento B')).not.toBeInTheDocument();
    expect(valueOf('Alcance')).toBe('1.61 m');
  });

  test('en drop la etiqueta es «Mostrar caída B»', () => {
    render(<ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} overlay />);

    expect(screen.getByRole('button', { name: 'Mostrar caída B' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('conmutar no reinicia el tiempo ni acorta la reproducción al vuelo de A', async () => {
    const user = userEvent.setup();
    // A (0.25 m) aterriza en 0.226 s y B (1 m) en 0.452 s: en 0.3 s solo B sigue en el aire.
    render(<ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} overlay initialTime_s={0.3} />);
    expect(valueOf('Tiempo')).toBe('0.300 s  ·  0.300 s');

    await user.click(screen.getByRole('button', { name: 'Mostrar caída B' }));

    expect(valueOf('Tiempo')).toBe('0.300 s');
    expect(screen.getByTestId('sim-clock')).toHaveTextContent('t 00.30 s');
  });

  test('con B oculto la reproducción dura lo que el vuelo más largo de A y B', () => {
    // Abierto más allá del aterrizaje de A: el tiempo se queda en el de B, 0.452 s.
    render(
      <ProjectileWidget
        mode="drop"
        initial={{ h_m: 0.25 }}
        overlay
        initialShowOverlay={false}
        initialTime_s={1}
      />,
    );

    expect(valueOf('Tiempo')).toBe('0.452 s');
  });

  test('cambiar de modo conserva el estado del conmutador', async () => {
    const user = userEvent.setup();
    render(<ProjectileWidget mode="launch" modes={['launch', 'drop']} initial={LAUNCH} overlay />);

    await user.click(screen.getByRole('button', { name: 'Mostrar lanzamiento B' }));
    await user.click(screen.getByRole('button', { name: 'Soltar' }));

    expect(screen.getByRole('button', { name: 'Mostrar caída B' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByText('Caída B')).not.toBeInTheDocument();
  });

  test('sin overlay, o en dropFromRobot, no hay conmutador', () => {
    const { unmount } = render(<ProjectileWidget mode="launch" initial={LAUNCH} />);
    expect(screen.queryByRole('button', { name: /Mostrar/ })).not.toBeInTheDocument();
    unmount();

    render(
      <ProjectileWidget mode="dropFromRobot" initial={{ vRobot_mps: 0.6, h_m: 0.25 }} overlay />,
    );
    expect(screen.queryByRole('button', { name: /Mostrar/ })).not.toBeInTheDocument();
  });
});
