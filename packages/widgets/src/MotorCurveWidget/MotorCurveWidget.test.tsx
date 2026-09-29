import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { MotorCurveWidget } from './MotorCurveWidget';

/** The line of the reference robot (docs/WIDGETS.md): τ_s = 0.012 N·m and n₀ = 6000 rpm. */
const LINE = { stallTorque_Nm: 0.012, noLoadSpeed_rpm: 6000 } as const;
/** Its currents and supply: I₀ = 0.1 A, I_s = 1.2 A at 6 V. */
const CURRENTS = { noLoadCurrent_A: 0.1, stallCurrent_A: 1.2, voltage_V: 6 } as const;
/** The golden case: the reference robot at its maximum power point. */
const REFERENCE = { ...LINE, ...CURRENTS, speed_rpm: 3000 } as const;

/** The value of one row of the values panel, by the text of its term. */
function valueOf(term: string): string {
  const panel = screen.getByTestId('readout-panel');
  return within(panel).getByText(term).nextElementSibling?.textContent ?? '';
}

/** Whether the values panel has a row with this term. */
function hasRow(term: string): boolean {
  return within(screen.getByTestId('readout-panel')).queryByText(term) !== null;
}

/** The slider whose accessible name starts with `label`. */
function sliderFor(label: string): HTMLElement {
  return screen.getByRole('slider', { name: new RegExp(`^${label}`) });
}

/** Sets a slider through the number field of its row. */
async function typeInto(label: string, value: string): Promise<void> {
  const user = userEvent.setup();
  const field = screen.getByRole('textbox', { name: new RegExp(`^Valor de ${label}$`) });
  await user.clear(field);
  await user.type(field, `${value}{Enter}`);
}

/** The `aria-live` sentence of the widget, found by its text. */
function statusText(): string {
  const status = screen
    .getAllByRole('status')
    .find((region) => region.textContent?.startsWith('A ') === true);
  expect(status).toHaveAttribute('aria-live', 'polite');
  return status?.textContent ?? '';
}

describe('MotorCurveWidget (W-MOTOR)', () => {
  test('W-MOTOR golden: en 3000 rpm τ = 0.006 N·m, P = 1.88 W, I = 0.65 A, P_el = 3.9 W, η = 0.483', () => {
    render(<MotorCurveWidget initial={REFERENCE} />);

    expect(valueOf('Velocidad')).toBe('3000 rpm');
    expect(valueOf('Velocidad angular')).toBe('314 rad/s');
    expect(valueOf('Torque')).toBe('0.00600 N·m');
    expect(valueOf('Potencia mecánica')).toBe('1.88 W');
    expect(valueOf('Corriente')).toBe('0.650 A');
    expect(valueOf('Potencia eléctrica')).toBe('3.90 W');
    expect(valueOf('Eficiencia del motor')).toBe('0.483');
  });

  test('W-MOTOR golden: en 0 rpm τ = 0.012 N·m, P = 0 e I = 1.2 A', async () => {
    render(<MotorCurveWidget initial={REFERENCE} />);
    await typeInto('Velocidad', '0');

    expect(valueOf('Velocidad')).toBe('0.00 rpm');
    expect(valueOf('Torque')).toBe('0.0120 N·m');
    expect(valueOf('Potencia mecánica')).toBe('0.00 W');
    expect(valueOf('Corriente')).toBe('1.20 A');
  });

  test('W-MOTOR golden: en 6000 rpm τ = 0, P = 0 e I = 0.1 A', async () => {
    render(<MotorCurveWidget initial={REFERENCE} />);
    await typeInto('Velocidad', '6000');

    expect(valueOf('Velocidad')).toBe('6000 rpm');
    expect(valueOf('Torque')).toBe('0.00 N·m');
    expect(valueOf('Potencia mecánica')).toBe('0.00 W');
    expect(valueOf('Corriente')).toBe('0.100 A');
  });

  test('W-MOTOR golden: con τ_s = 0.024 N·m, P_max = 3.77 W en 3000 rpm', async () => {
    render(<MotorCurveWidget initial={REFERENCE} editable={['stallTorque_Nm']} />);
    await typeInto('Torque de bloqueo', '0.024');

    expect(valueOf('Velocidad')).toBe('3000 rpm');
    expect(valueOf('Potencia mecánica')).toBe('3.77 W');
  });

  test('sin corrientes no hay filas de corriente, potencia eléctrica ni eficiencia', () => {
    render(<MotorCurveWidget initial={LINE} />);

    expect(hasRow('Torque')).toBe(true);
    expect(hasRow('Corriente')).toBe(false);
    expect(hasRow('Potencia eléctrica')).toBe(false);
    expect(hasRow('Eficiencia del motor')).toBe(false);
    expect(statusText()).toBe('A 3000 rpm el motor da 0.00600 N·m y 1.88 W');
  });

  test('sin tensión tampoco, aunque haya corrientes', () => {
    render(<MotorCurveWidget initial={{ ...LINE, noLoadCurrent_A: 0.1, stallCurrent_A: 1.2 }} />);

    expect(hasRow('Corriente')).toBe(false);
    expect(hasRow('Eficiencia del motor')).toBe(false);
  });

  test('el punto de trabajo por defecto es n₀/2', () => {
    render(<MotorCurveWidget initial={LINE} />);

    expect(valueOf('Velocidad')).toBe('3000 rpm');
    expect(sliderFor('Velocidad en rpm')).toHaveAttribute('aria-valuenow', '3000');
  });

  test('describe el punto de trabajo en una región aria-live, con la corriente', () => {
    render(<MotorCurveWidget initial={REFERENCE} />);

    expect(statusText()).toBe('A 3000 rpm el motor da 0.00600 N·m y 1.88 W con 0.650 A');
  });

  test('sin editable solo hay el deslizador «Velocidad», de 0 a n₀ con paso 1', () => {
    render(<MotorCurveWidget initial={REFERENCE} />);

    const panel = screen.getByRole('region', { name: 'Parámetros' });
    const sliders = within(panel).getAllByRole('slider');
    expect(sliders.map((slider) => slider.getAttribute('aria-label'))).toEqual([
      'Velocidad en rpm',
    ]);
    expect(sliders[0]).toHaveAttribute('min', '0');
    expect(sliders[0]).toHaveAttribute('max', '6000');
    expect(sliders[0]).toHaveAttribute('step', '1');
  });

  test('editable añade τ_s y n₀ al mismo panel con los rangos del catálogo', () => {
    render(
      <MotorCurveWidget initial={REFERENCE} editable={['stallTorque_Nm', 'noLoadSpeed_rpm']} />,
    );

    const panel = screen.getByRole('region', { name: 'Parámetros' });
    const sliders = within(panel).getAllByRole('slider');
    expect(sliders.map((slider) => slider.getAttribute('aria-label'))).toEqual([
      'Velocidad en rpm',
      'Torque de bloqueo en N·m',
      'Velocidad sin carga en rpm',
    ]);
    const stall = sliderFor('Torque de bloqueo');
    expect(stall).toHaveAttribute('min', '0.001');
    expect(stall).toHaveAttribute('max', '0.2');
    const noLoad = sliderFor('Velocidad sin carga');
    expect(noLoad).toHaveAttribute('min', '500');
    expect(noLoad).toHaveAttribute('max', '20000');
  });

  test('bajar n₀ por debajo del punto lo recorta a n₀', async () => {
    render(<MotorCurveWidget initial={REFERENCE} editable={['noLoadSpeed_rpm']} />);
    await typeInto('Velocidad sin carga', '2000');

    expect(sliderFor('Velocidad en rpm')).toHaveAttribute('aria-valuenow', '2000');
    expect(sliderFor('Velocidad en rpm')).toHaveAttribute('max', '2000');
    expect(valueOf('Velocidad')).toBe('2000 rpm');
    expect(valueOf('Torque')).toBe('0.00 N·m');
  });

  test('el deslizador mueve el punto con el teclado: el panel y los marcadores cambian', async () => {
    const user = userEvent.setup();
    render(<MotorCurveWidget initial={REFERENCE} />);

    const speed = sliderFor('Velocidad en rpm');
    await user.click(speed);
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');

    expect(speed).toHaveAttribute('aria-valuenow', '3010');
    expect(valueOf('Velocidad')).toBe('3010 rpm');
    expect(valueOf('Torque')).toBe('0.00598 N·m');
    // The two charts share the working point: both markers moved with the slider.
    const markers = screen.getAllByRole('slider', { name: 'Marcador de tiempo' });
    expect(markers).toHaveLength(2);
    for (const marker of markers) expect(marker).toHaveAttribute('aria-valuenow', '3010');
  });

  test('el marcador de una gráfica mueve el deslizador y la otra gráfica', async () => {
    const user = userEvent.setup();
    render(<MotorCurveWidget initial={REFERENCE} />);

    const [torqueMarker] = screen.getAllByRole('slider', { name: 'Marcador de tiempo' });
    if (torqueMarker === undefined) throw new Error('missing marker');
    await user.click(torqueMarker);
    // One arrow step is 2 % of the 0 to 6000 rpm range: 120 rpm.
    await user.keyboard('{ArrowRight}');

    expect(sliderFor('Velocidad en rpm')).toHaveAttribute('aria-valuenow', '3120');
    expect(valueOf('Velocidad')).toBe('3120 rpm');
    const markers = screen.getAllByRole('slider', { name: 'Marcador de tiempo' });
    for (const marker of markers) expect(marker).toHaveAttribute('aria-valuenow', '3120');
  });

  test('las dos gráficas llevan su descripción y comparten el eje de velocidad', () => {
    render(<MotorCurveWidget initial={REFERENCE} />);

    expect(screen.getByRole('region', { name: /^Recta torque/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /^Parábola de potencia/ })).toBeInTheDocument();
    const markers = screen.getAllByRole('slider', { name: 'Marcador de tiempo' });
    for (const marker of markers) {
      expect(marker).toHaveAttribute('aria-valuemin', '0');
      expect(marker).toHaveAttribute('aria-valuemax', '6000');
    }
  });

  test('es determinista: los mismos props dan el mismo panel', () => {
    const first = render(<MotorCurveWidget initial={REFERENCE} />);
    const html = screen.getByTestId('readout-panel').innerHTML;
    first.unmount();
    render(<MotorCurveWidget initial={REFERENCE} />);
    expect(screen.getByTestId('readout-panel').innerHTML).toBe(html);
  });
});
