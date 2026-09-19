import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { FreeBodyWidget } from './FreeBodyWidget';
import type { ForceInput } from './compute';

/** The forces of the «Explora» of T-2.1: traction 1.5 N and rolling friction 0.4 N. */
function exploreForces(): ForceInput[] {
  return [
    { key: 'traction', label: 'Tracción', magnitude_N: 1.5, angle_rad: 0, editable: true },
    { key: 'friction', label: 'Fricción de rodadura', magnitude_N: 0.4, angle_rad: 3.1416, editable: true },
  ];
}

/** The value of one row of the values panel, by the text of its term. */
function valueOf(term: string): string {
  const panel = screen.getByTestId('readout-panel');
  return within(panel).getByText(term).nextElementSibling?.textContent ?? '';
}

describe('FreeBodyWidget (F2-03)', () => {
  test('shows the golden values of T-2.1 on a plane: N = 8.829 N and a = 1.222 m/s²', () => {
    render(<FreeBodyWidget mass_kg={0.9} forces={exploreForces()} slope_rad={0} showResultant />);

    expect(valueOf('Masa')).toBe('0.900 kg');
    expect(valueOf('Peso')).toBe('8.83 N');
    expect(valueOf('Normal')).toBe('8.83 N');
    expect(valueOf('Resultante')).toBe('1.10 N');
    expect(valueOf('Aceleración')).toBe('1.22 m/s²');
  });

  test('on a 15° ramp the weight splits into 2.285 N along and 8.528 N normal', () => {
    render(
      <FreeBodyWidget mass_kg={0.9} forces={exploreForces()} slope_rad={0.2618} showResultant />,
    );

    expect(valueOf('Peso a lo largo de la superficie')).toBe('2.29 N');
    expect(valueOf('Normal')).toBe('8.53 N');
  });

  test('without `showResultant` the panel omits the resultant and the acceleration', () => {
    render(<FreeBodyWidget mass_kg={0.9} forces={exploreForces()} />);

    expect(screen.queryByText('Resultante')).not.toBeInTheDocument();
    expect(screen.queryByText('Aceleración')).not.toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();
  });

  test('each editable force gets a magnitude and an angle slider; the derived ones do not', () => {
    render(<FreeBodyWidget mass_kg={0.9} forces={exploreForces()} showResultant />);

    const labels = screen.getAllByRole('slider').map((slider) => slider.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Tracción: magnitud en N',
      'Tracción: ángulo en °',
      'Fricción de rodadura: magnitud en N',
      'Fricción de rodadura: ángulo en °',
    ]);
  });

  test('raising the traction with the keyboard raises the resultant and the acceleration', async () => {
    const user = userEvent.setup();
    render(<FreeBodyWidget mass_kg={0.9} forces={exploreForces()} showResultant />);

    expect(valueOf('Resultante')).toBe('1.10 N');
    const traction = screen.getByRole('slider', { name: 'Tracción: magnitud en N' });
    traction.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');

    expect(valueOf('Resultante')).toBe('1.30 N');
    expect(valueOf('Aceleración')).toBe('1.44 m/s²');
  });

  test('equal traction and friction leave a zero resultant (experiment 1 of T-2.1)', async () => {
    const user = userEvent.setup();
    render(<FreeBodyWidget mass_kg={0.9} forces={exploreForces()} showResultant />);

    const traction = screen.getByRole('slider', { name: 'Tracción: magnitud en N' });
    traction.focus();
    // 1.5 N down to 0.4 N: eleven steps of 0.1 N, one Shift+arrow plus one arrow.
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}{ArrowLeft}');

    // T-2.1 writes the friction angle as 3.1416, not as PI, so the two forces cancel to a
    // residual of a few microneutons rather than to an exact zero; a = 3e-6 m/s2 is «cero» at
    // any scale the panel shows (the widget never rounds a number itself).
    expect(Number(valueOf('Resultante').replace(' N', ''))).toBeLessThan(1e-4);
    expect(Number(valueOf('Aceleración').replace(' m/s²', ''))).toBeLessThan(1e-4);
  });

  test('doubling the mass halves the acceleration (experiment 3 of T-2.1)', () => {
    const { unmount } = render(
      <FreeBodyWidget mass_kg={0.9} forces={exploreForces()} showResultant />,
    );
    expect(valueOf('Aceleración')).toBe('1.22 m/s²');
    unmount();

    render(<FreeBodyWidget mass_kg={1.8} forces={exploreForces()} showResultant />);
    expect(valueOf('Aceleración')).toBe('0.611 m/s²');
  });

  test('a diagram with no editable force shows no parameter panel', () => {
    render(
      <FreeBodyWidget
        mass_kg={0.9}
        forces={[{ key: 'traction', label: 'Tracción', magnitude_N: 0.72, angle_rad: 0 }]}
        showResultant
      />,
    );

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(valueOf('Resultante')).toBe('0.720 N');
  });

  test('describes its state in an `aria-live` region and names the scene', () => {
    render(<FreeBodyWidget mass_kg={0.9} forces={exploreForces()} showResultant />);

    const live = screen.getAllByRole('status').map((region) => region.getAttribute('aria-live'));
    expect(live).toContain('polite');
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Diagrama de cuerpo libre con el peso, la normal y las fuerzas aplicadas',
    );
  });
});
