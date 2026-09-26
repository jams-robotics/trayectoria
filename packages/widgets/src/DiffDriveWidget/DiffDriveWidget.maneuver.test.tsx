import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { DiffDriveWidget } from './DiffDriveWidget';
import type { DiffDriveMode } from './DiffDriveWidget';

/** The «Explora» of T-5.5 (docs/CURRICULUM.md): 90° and 0.2 m at the default speeds. */
const T55 = { turn_deg: 90, distance_m: 0.2 } as const;
/**
 * A faster maneuver for the runs through the widget, where every «Paso» costs a render: 5 rad/s
 * and 0.5 m/s give `T = 2·(π/2)/5 + 0.1/0.5 = 0.828 s`. The golden run of T-5.5 at the default
 * speeds lives in `maneuver.test.ts`, on the same model.
 */
const FAST = { turn_deg: 90, distance_m: 0.1, omega_radps: 5, v_mps: 0.5 } as const;
/** Steps of `DT_S = 0.01 s` that pass the end of `FAST`. */
const PAST_END_STEPS = 85;
/** Budget of the runs through the widget, in milliseconds. */
const RUN_TIMEOUT_MS = 20_000;
/** Wait for the `aria-live` region, which announces at most every 2 s (`LiveStatus`). */
const LIVE_WAIT = { timeout: 3_000 } as const;
const TOGGLE = 'Maniobra en tres movimientos';

/** The value of one row of a values panel, by the text of its term. */
function valueOf(term: string): string {
  for (const panel of screen.getAllByTestId('readout-panel')) {
    const dt = within(panel).queryByText(term);
    if (dt !== null) return dt.nextElementSibling?.textContent ?? '';
  }
  return '';
}

function renderT55(
  mode: DiffDriveMode = 'inverse',
  maneuver: typeof T55 | typeof FAST = T55,
): void {
  render(
    <DiffDriveWidget
      mode={mode}
      show={['frames', 'trace']}
      initial={{ v_mps: 0.3, omega_radps: 0 }}
      maneuver={maneuver}
      duration_s={6}
    />,
  );
}

/** The text of the `aria-live` regions of the widget, joined. */
function liveText(): string {
  return screen
    .getAllByRole('status')
    .map((element) => element.textContent)
    .join(' ');
}

/** Advances `steps` explicit steps of «Paso», one render per step (#258). */
function stepSimulation(steps: number): void {
  const button = screen.getByRole('button', { name: 'Paso' });
  for (let step = 0; step < steps; step += 1) fireEvent.click(button);
}

async function turnOn(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: TOGGLE }));
}

describe('DiffDriveWidget maniobra en tres movimientos (#394, T-5.5)', () => {
  test('sin la prop o fuera de inverse no hay conmutador', () => {
    render(<DiffDriveWidget mode="inverse" show={['trace']} initial={{ v_mps: 0.3 }} />);
    expect(screen.queryByRole('button', { name: TOGGLE })).toBeNull();
  });

  test('en forward la prop se ignora', () => {
    renderT55('forward');
    expect(screen.queryByRole('button', { name: TOGGLE })).toBeNull();
    expect(valueOf('Fase')).toBe('');
  });

  test('el conmutador empieza desactivado y sustituye v y ω por Giro y Avance', async () => {
    const user = userEvent.setup();
    renderT55();
    const toggle = screen.getByRole('button', { name: TOGGLE });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(valueOf('Fase')).toBe('');
    await turnOn(user);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('slider', { name: /^Giro/ })).toHaveValue('90');
    expect(screen.getByRole('slider', { name: /^Avance/ })).toHaveValue('0.2');
    expect(screen.queryByRole('slider', { name: /^Velocidad lineal del robot/ })).toBeNull();
    await user.click(toggle);
    expect(screen.getByRole('slider', { name: /^Velocidad lineal del robot/ })).toHaveValue('0.3');
  });

  test(
    'T-5.5 golden: T = 4.142 s y la fase 1 gira a 1 rad/s con v = 0',
    async () => {
      const user = userEvent.setup();
      renderT55();
      await turnOn(user);
      expect(valueOf('Duración de la maniobra')).toBe('4.14 s');
      expect(valueOf('Fase')).toBe('1 · Girar');
      expect(valueOf('Velocidad angular')).toBe('1.00 rad/s');
      expect(valueOf('Velocidad lineal')).toBe('0.00 m/s');
      await waitFor(() => {
        expect(liveText()).toMatch(/fase de la maniobra: 1 · Girar/);
      }, LIVE_WAIT);
    },
    RUN_TIMEOUT_MS,
  );

  test(
    'las fases se suceden y al terminar la pose es (0, d, θ₀) con el robot quieto',
    async () => {
      const user = userEvent.setup();
      renderT55('inverse', FAST);
      await turnOn(user);
      expect(valueOf('Duración de la maniobra')).toBe('0.828 s');
      stepSimulation(40);
      expect(valueOf('Fase')).toBe('2 · Avanzar');
      expect(valueOf('Velocidad lineal')).toBe('0.500 m/s');
      stepSimulation(20);
      expect(valueOf('Fase')).toBe('3 · Girar');
      expect(valueOf('Velocidad angular')).toBe('-5.00 rad/s');
      stepSimulation(PAST_END_STEPS - 60);
      expect(valueOf('Fase')).toBe('Terminada');
      await waitFor(() => {
        expect(liveText()).toMatch(/fase de la maniobra: Terminada/);
      }, LIVE_WAIT);
      expect(valueOf('Posición x')).toBe('0.00 m');
      expect(valueOf('Posición y')).toBe('0.100 m');
      expect(valueOf('Orientación')).toBe('0.00 °');
      expect(valueOf('Velocidad lineal')).toBe('0.00 m/s');
      expect(valueOf('Velocidad angular')).toBe('0.00 rad/s');
    },
    RUN_TIMEOUT_MS,
  );

  test(
    'mover un slider de la maniobra reinicia a t = 0 y a la pose inicial',
    async () => {
      const user = userEvent.setup();
      renderT55('inverse', FAST);
      await turnOn(user);
      stepSimulation(50);
      expect(valueOf('Posición y')).not.toBe('0.00 m');
      const field = screen.getByRole('textbox', { name: /Giro/ });
      await user.clear(field);
      await user.type(field, '-90{Enter}');
      expect(valueOf('Fase')).toBe('1 · Girar');
      expect(valueOf('Posición y')).toBe('0.00 m');
      expect(liveText()).toMatch(/t 00\.00 s/);
      stepSimulation(PAST_END_STEPS);
      expect(valueOf('Posición y')).toBe('-0.100 m');
    },
    RUN_TIMEOUT_MS,
  );
});
