import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { DiffDriveWidget } from './DiffDriveWidget';

describe('DiffDriveWidget controles a la vista y plegados (v1.5)', () => {
  /** Names of the sliders in view and of the ones behind «Más controles». */
  function controls(): { inView: string[]; folded: string[] } {
    const names = (sliders: HTMLElement[]): string[] =>
      sliders.map((slider) => (slider.getAttribute('aria-label') ?? '').replace(/ en .*$/, ''));
    const more = screen.queryByTestId('params-more');
    const folded = more === null ? [] : within(more).getAllByRole('slider');
    return {
      inView: names(screen.getAllByRole('slider').filter((slider) => !folded.includes(slider))),
      folded: names(folded),
    };
  }

  test.each([
    ['T-4.5 (odometry, encoders)', 'odometry', ['trace', 'wheelVelocities'], ['Velocidad rueda izquierda', 'Velocidad rueda derecha', 'Ticks por vuelta de rueda']],
    ['T-5.1 (forward, frames)', 'forward', ['frames', 'trace'], ['Orientación inicial']],
    ['T-5.2 (forward)', 'forward', ['icr', 'radius', 'trace', 'wheelVelocities'], ['Velocidad rueda izquierda', 'Velocidad rueda derecha']],
    ['T-5.3 (inverse)', 'inverse', ['icr', 'radius', 'wheelVelocities'], ['Velocidad lineal del robot', 'Velocidad angular del robot']],
    ['T-5.4 (odometry, frames)', 'odometry', ['trace', 'frames'], ['Radio de rueda creído', 'Distancia entre ruedas creída']],
    ['T-5.5 (inverse, frames)', 'inverse', ['frames', 'trace'], ['Velocidad lineal del robot', 'Velocidad angular del robot', 'Orientación inicial']],
  ] as const)('%s deja a la vista solo lo que su «Explora» mueve', (_topic, mode, show, expected) => {
    render(<DiffDriveWidget mode={mode} show={[...show]} initial={{}} />);
    const { inView, folded } = controls();
    expect(inView).toEqual(expected);
    expect(screen.getAllByRole('slider')).toHaveLength(inView.length + folded.length);
  });

  test('un slider plegado sigue funcionando y la maniobra toma el lugar de v y ω a la vista', async () => {
    const user = userEvent.setup();
    render(<DiffDriveWidget mode="inverse" show={['frames']} initial={{}} maneuver={{ turn_deg: 90, distance_m: 0.2 }} />);
    await user.click(screen.getByRole('button', { name: 'Maniobra en tres movimientos' }));
    expect(controls().inView).toEqual(['Giro', 'Avance', 'Orientación inicial']);
  });
});
