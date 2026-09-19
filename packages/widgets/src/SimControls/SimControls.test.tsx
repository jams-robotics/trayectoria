import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import type { SimulationDriver } from '../Scene2D/useSimulationDriver';
import { SPEEDS, SimControls, formatTime } from './SimControls';

/** A driver whose actions are spies, so the test sees exactly which one a control fired. */
function createDriver(overrides: Partial<SimulationDriver<unknown>> = {}): SimulationDriver<unknown> {
  return {
    state: null,
    t_s: 0,
    running: false,
    play: vi.fn(),
    pause: vi.fn(),
    step: vi.fn(),
    reset: vi.fn(),
    speed: 1,
    setSpeed: vi.fn(),
    ...overrides,
  };
}

describe('SimControls', () => {
  test('shows the controls in the order of the design: play, pause, step, reset', () => {
    render(<SimControls {...createDriver()} />);

    const labels = screen.getAllByRole('button').map((button) => button.textContent);
    expect(labels).toEqual(['Reproducir', 'Pausa', 'Paso', 'Reiniciar']);
  });

  test('each button fires its action of the driver', async () => {
    const user = userEvent.setup();
    const driver = createDriver({ running: true });
    render(<SimControls {...driver} />);

    await user.click(screen.getByRole('button', { name: 'Pausa' }));
    expect(driver.pause).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Paso' }));
    expect(driver.step).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(driver.reset).toHaveBeenCalledTimes(1);
  });

  test('Reproducir is disabled while running and Pausa while paused', async () => {
    const user = userEvent.setup();
    const paused = createDriver();
    const { unmount } = render(<SimControls {...paused} />);

    expect(screen.getByRole('button', { name: 'Pausa' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reproducir' }));
    expect(paused.play).toHaveBeenCalledTimes(1);
    unmount();

    render(<SimControls {...createDriver({ running: true })} />);
    expect(screen.getByRole('button', { name: 'Reproducir' })).toBeDisabled();
  });

  test('the speed selector offers the five speeds and reports the chosen one', async () => {
    const user = userEvent.setup();
    const driver = createDriver();
    render(<SimControls {...driver} />);

    const select = screen.getByRole('combobox', { name: 'Velocidad de reproducción' });
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(
      SPEEDS.map((speed) => `${String(speed)}×`),
    );
    await user.selectOptions(select, '4');
    expect(driver.setSpeed).toHaveBeenCalledWith(4);
  });

  test('the clock shows the simulated time with two decimals, hidden in compact mode', () => {
    const { unmount } = render(<SimControls {...createDriver({ t_s: 3.456 })} />);
    expect(screen.getByTestId('sim-clock')).toHaveTextContent('t 03.46 s');
    unmount();

    render(<SimControls {...createDriver({ t_s: 3.456 })} compact />);
    expect(screen.queryByTestId('sim-clock')).toBeNull();
  });

  test('Espacio plays when paused and pauses when running, with the focus inside', async () => {
    const user = userEvent.setup();
    const paused = createDriver();
    const { unmount } = render(<SimControls {...paused} />);

    await user.tab();
    await user.keyboard(' ');
    expect(paused.play).toHaveBeenCalledTimes(1);
    unmount();

    const running = createDriver({ running: true });
    render(<SimControls {...running} />);
    await user.tab();
    await user.keyboard(' ');
    expect(running.pause).toHaveBeenCalledTimes(1);
  });

  test('«.» steps and «R» resets', async () => {
    const user = userEvent.setup();
    const driver = createDriver();
    render(<SimControls {...driver} />);

    await user.tab();
    await user.keyboard('.');
    expect(driver.step).toHaveBeenCalledTimes(1);

    await user.keyboard('R');
    expect(driver.reset).toHaveBeenCalledTimes(1);

    await user.keyboard('r');
    expect(driver.reset).toHaveBeenCalledTimes(2);
  });

  test('a shortcut outside the widget does nothing (it is bound to the container)', async () => {
    const user = userEvent.setup();
    const driver = createDriver();
    // Through a variable: the i18n lint rule forbids JSX text with letters in this package.
    const outside = 'Fuera';
    render(
      <div>
        <button type="button">{outside}</button>
        <SimControls {...driver} />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: outside }));
    await user.keyboard('.');
    await user.keyboard('R');

    expect(driver.step).not.toHaveBeenCalled();
    expect(driver.reset).not.toHaveBeenCalled();
  });

  test('a key typed on the speed selector is left to the selector', async () => {
    const user = userEvent.setup();
    const driver = createDriver();
    render(<SimControls {...driver} />);

    const select = screen.getByRole('combobox', { name: 'Velocidad de reproducción' });
    select.focus();
    await user.keyboard('r');

    expect(driver.reset).not.toHaveBeenCalled();
  });

  test('announces the state of the simulation politely', () => {
    const { unmount } = render(<SimControls {...createDriver({ running: true, t_s: 1.5 })} />);
    expect(screen.getByRole('status')).toHaveTextContent('En marcha, t 01.50 s');
    unmount();

    render(<SimControls {...createDriver({ t_s: 0 })} />);
    expect(screen.getByRole('status')).toHaveTextContent('En pausa, t 00.00 s');
  });

  test('formatTime pads to two integer digits and guards a non-finite time', () => {
    expect(formatTime(0)).toBe('00.00');
    expect(formatTime(7.006)).toBe('07.01');
    expect(formatTime(123.4)).toBe('123.40');
    expect(formatTime(Number.NaN)).toBe('00.00');
    expect(formatTime(-1)).toBe('00.00');
  });
});
