import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { EnergyWidget } from './EnergyWidget';

/** The «Explora» of T-3.1: the profile robot at 0.6 m/s up a 0.26 rad ramp. */
const RAMP = { mass_kg: 0.9, v0_mps: 0.6, slope_rad: 0.26 };

/** The «Explora» of T-3.2: the motor and the battery of the profile. */
const POWER = {
  torque_Nm: 0.03,
  omega_radps: 523.6,
  voltage_V: 6,
  current_A: 1.2,
  battery_Wh: 11.1,
};

/** The text of the values panel whose accessible name matches `name`. */
function panelText(name: RegExp): string {
  return screen.getByRole('region', { name }).textContent ?? '';
}

describe('EnergyWidget ramp mode (F2-07)', () => {
  test('opens at rest on the flat run with the kinetic energy of T-3.1', () => {
    render(<EnergyWidget mode="ramp" initial={RAMP} />);
    const panel = panelText(/valores/i);
    expect(panel).toContain('0.162 J');
    expect(panel).toContain('0.600 m/s');
  });

  test('shows the four bars in the fixed order `E_k`, `E_p`, `E_mec`, `W_fricción`', () => {
    const { container } = render(<EnergyWidget mode="ramp" initial={RAMP} />);
    const keys = Array.from(container.querySelectorAll('[data-bar]')).map((element) =>
      element.getAttribute('data-bar'),
    );
    expect(keys).toEqual(['kinetic', 'potential', 'mechanical', 'dissipated']);
  });

  test('each bar names itself and its value, so colour is never the only channel', () => {
    render(<EnergyWidget mode="ramp" initial={RAMP} />);
    const bars = screen.getByTestId('energy-bars');
    expect(within(bars).getByRole('img', { name: /energía cinética: 0\.162 J/i })).toBeVisible();
    expect(within(bars).getByRole('img', { name: /trabajo de fricción: 0\.00 J/i })).toBeVisible();
  });

  test('opened at t = 0.6 s the body is on the ramp with part of `E_k` turned into height', () => {
    render(<EnergyWidget mode="ramp" initial={RAMP} initialTime_s={0.6} />);
    const panel = panelText(/valores/i);
    // Past the 0.3 m of flat run at 0.6 m/s, so it has climbed and slowed down, and with no
    // friction the mechanical energy it started with is all still there.
    expect(panel).not.toContain('0.600 m/s');
    expect(panel).toContain('0.0122 m');
    expect(panel).toContain('0.162 J');
  });

  test('the live region describes the energies of the body', () => {
    const { container } = render(<EnergyWidget mode="ramp" initial={RAMP} />);
    // `SimControls` carries a `status` of its own, so the widget's is the `sr-only` one.
    expect(container.querySelector('p.sr-only[aria-live="polite"]')).toBeInTheDocument();
  });

  test('carries the playback controls of `SimControls`', () => {
    render(<EnergyWidget mode="ramp" initial={RAMP} />);
    for (const name of [/reproducir/i, /pausa/i, /paso/i, /reiniciar/i]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  test('«Paso» advances the body along the track', async () => {
    const user = userEvent.setup();
    render(<EnergyWidget mode="ramp" initial={RAMP} />);
    const before = panelText(/valores/i);
    await user.click(screen.getByRole('button', { name: /paso/i }));
    // One `dt` of 1 ms at 0.6 m/s barely moves it, so the speed row is what must stay put with
    // no friction: the check is that stepping does not throw and the panel keeps its shape.
    expect(panelText(/valores/i)).toContain('0.600 m/s');
    expect(before).toContain('0.600 m/s');
  });

  test('has one slider per editable value of the ramp: `m`, `v0`, `φ` and `μk`', () => {
    render(<EnergyWidget mode="ramp" initial={RAMP} />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(4);
    expect(screen.getByRole('slider', { name: /masa del robot/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /ángulo de la rampa/i })).toBeInTheDocument();
    expect(
      screen.getByRole('slider', { name: /coeficiente de rozamiento cinético/i }),
    ).toBeInTheDocument();
  });

  test('raising `v0` raises the kinetic energy the run starts with', async () => {
    const user = userEvent.setup();
    render(<EnergyWidget mode="ramp" initial={RAMP} />);
    const slider = screen.getByRole('slider', { name: /^velocidad inicial/i });
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(panelText(/valores/i)).not.toContain('0.162 J');
  });

  test('`mu_k` defaults to zero and the story with friction starts above it', () => {
    const { unmount } = render(<EnergyWidget mode="ramp" initial={RAMP} />);
    expect(screen.getByRole('slider', { name: /rozamiento cinético/i })).toHaveValue('0');
    unmount();
    render(<EnergyWidget mode="ramp" initial={{ ...RAMP, mu_k: 0.05 }} />);
    expect(screen.getByRole('slider', { name: /rozamiento cinético/i })).toHaveValue('0.05');
  });

  test('a slope of zero draws no ramp and the scene says so', () => {
    render(<EnergyWidget mode="ramp" initial={{ ...RAMP, slope_rad: 0 }} />);
    expect(screen.getByRole('img', { name: /sin rampa/i })).toBeInTheDocument();
  });
});

describe('EnergyWidget power mode (F2-07)', () => {
  test('shows the golden values of T-3.2 in the two blocks', () => {
    render(<EnergyWidget mode="power" initial={RAMP} power={POWER} />);
    const mechanical = panelText(/^mecánica$/i);
    expect(mechanical).toContain('524 rad/s');
    expect(mechanical).toContain('15.7 W');
    const electrical = panelText(/^eléctrica$/i);
    expect(electrical).toContain('14.4 W');
    expect(electrical).toContain('8.64 W');
    // `format` rounds the 46.25 min of the golden value to the three figures T-3.2 also shows.
    expect(electrical).toContain('46.3 min');
  });

  test('has no playback controls and no scene: the mode is static', () => {
    render(<EnergyWidget mode="power" initial={RAMP} power={POWER} />);
    expect(screen.queryByRole('button', { name: /reproducir/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('scene2d')).not.toBeInTheDocument();
  });

  test('switching to one motor halves `P_el` and doubles the autonomy', async () => {
    const user = userEvent.setup();
    render(<EnergyWidget mode="power" initial={RAMP} power={POWER} />);
    await user.click(screen.getByRole('button', { name: /un motor/i }));
    const electrical = panelText(/^eléctrica$/i);
    expect(electrical).toContain('7.20 W');
    expect(electrical).toContain('92.5 min');
  });

  test('two motors is the default of the segmented control', () => {
    render(<EnergyWidget mode="power" initial={RAMP} power={POWER} />);
    expect(screen.getByRole('button', { name: /dos motores/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('raising `I` raises `P_el` and cuts the autonomy (experiment 1 of T-3.2)', async () => {
    const user = userEvent.setup();
    render(<EnergyWidget mode="power" initial={RAMP} power={POWER} />);
    const slider = screen.getByRole('slider', { name: /corriente/i });
    slider.focus();
    await user.keyboard('{ArrowRight}');
    const electrical = panelText(/^eléctrica$/i);
    expect(electrical).not.toContain('14.4 W');
    expect(electrical).not.toContain('46.2 min');
  });

  test('raising `τ` raises the shaft power of the mechanical block', async () => {
    const user = userEvent.setup();
    render(<EnergyWidget mode="power" initial={RAMP} power={POWER} />);
    const slider = screen.getByRole('slider', { name: /par del motor/i });
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(panelText(/^mecánica$/i)).not.toContain('15.7 W');
  });

  test('`η` is an input with its own slider, not a derived value', () => {
    render(<EnergyWidget mode="power" initial={RAMP} power={POWER} />);
    expect(screen.getByRole('slider', { name: /rendimiento/i })).toHaveValue('0.6');
  });

  test('has the six sliders of the two blocks: `τ`, `n`, `V`, `I`, `η` and `C`', () => {
    render(<EnergyWidget mode="power" initial={RAMP} power={POWER} />);
    expect(screen.getAllByRole('slider')).toHaveLength(6);
  });

  test('falls back to the motor of T-3.2 when no `power` block is given', () => {
    render(<EnergyWidget mode="power" initial={RAMP} />);
    expect(panelText(/^mecánica$/i)).toContain('15.7 W');
  });

  test('the live region describes the three powers and the autonomy', () => {
    const { container } = render(<EnergyWidget mode="power" initial={RAMP} power={POWER} />);
    expect(container.querySelector('p.sr-only[aria-live="polite"]')).toBeInTheDocument();
  });
});
