import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { PowerWidget } from './PowerWidget';

/** The golden case of docs/WIDGETS.md, PowerWidget: 4.32 W lifting 0.9 kg by 1 m. */
const GOLDEN = { power_W: 4.32, mass_kg: 0.9 } as const;

/** The value of one row of the values panel, by the text of its term. */
function valueOf(term: string): string {
  const panel = screen.getByTestId('readout-panel');
  return within(panel).getByText(term).nextElementSibling?.textContent ?? '';
}

/** Sets a slider through the number field of its row. */
async function typeInto(label: string, value: string): Promise<void> {
  const user = userEvent.setup();
  const field = screen.getByRole('textbox', { name: new RegExp(label) });
  await user.clear(field);
  await user.type(field, `${value}{Enter}`);
}

describe('PowerWidget (#360)', () => {
  test('muestra los valores dorados: v = 0.489 m/s y t_subida = 2.04 s', () => {
    render(<PowerWidget initial={GOLDEN} />);

    expect(valueOf('Potencia')).toBe('4.32 W');
    expect(valueOf('Masa')).toBe('0.900 kg');
    expect(valueOf('Velocidad de subida')).toBe('0.489 m/s');
    expect(valueOf('Tiempo de subida')).toBe('2.04 s');
    expect(valueOf('Altura')).toBe('0.00 m');
    expect(valueOf('Energía potencial')).toBe('0.00 J');
  });

  test('en t = 1 s: h = 0.489 m y E_p = W = P t = 4.32 J', () => {
    render(<PowerWidget initial={GOLDEN} initialTime_s={1} />);

    expect(valueOf('Altura')).toBe('0.489 m');
    expect(valueOf('Energía potencial')).toBe('4.32 J');
    expect(valueOf('Trabajo del motor')).toBe('4.32 J');
    expect(screen.getByTestId('power-bar-value')).toHaveTextContent('4.32 J / 8.83 J');
  });

  test('pasado t_subida la carga queda arriba con E_p = m g H = 8.83 J y la barra llena', () => {
    render(<PowerWidget initial={GOLDEN} initialTime_s={5} />);

    expect(valueOf('Altura')).toBe('1.00 m');
    expect(valueOf('Energía potencial')).toBe('8.83 J');
    expect(screen.getByTestId('power-bar-fill')).toHaveStyle({ height: '100.0%' });
  });

  test('con P = 8.64 W la subida dura 1.02 s y se recalcula en el t actual', async () => {
    render(<PowerWidget initial={GOLDEN} initialTime_s={0.5} />);
    await typeInto('Potencia', '8.64');

    expect(valueOf('Tiempo de subida')).toBe('1.02 s');
    // At t = 0.5 s, h = 0.5 · 8.64 / (0.9 · 9.81) = 0.489 m.
    expect(valueOf('Altura')).toBe('0.489 m');
  });

  test('con m = 1.8 kg la subida dura 4.09 s', async () => {
    render(<PowerWidget initial={GOLDEN} />);
    await typeInto('Masa', '1.8');

    expect(valueOf('Tiempo de subida')).toBe('4.09 s');
  });

  test('si el t actual supera el nuevo t_subida, la carga queda arriba', async () => {
    render(<PowerWidget initial={GOLDEN} initialTime_s={1.5} />);
    await typeInto('Potencia', '8.64');

    expect(valueOf('Altura')).toBe('1.00 m');
  });

  test('H es una prop fija sin deslizador: solo hay P y m, con los rangos del catálogo', () => {
    render(<PowerWidget initial={GOLDEN} liftHeight_m={0.5} />);

    const panel = screen.getByRole('region', { name: 'Parámetros' });
    const sliders = within(panel).getAllByRole('slider');
    expect(sliders.map((slider) => slider.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^Potencia/),
      expect.stringMatching(/^Masa/),
    ]);
    expect(sliders[0]).toHaveAttribute('min', '0.5');
    expect(sliders[0]).toHaveAttribute('max', '20');
    expect(sliders[0]).toHaveAttribute('step', '0.01');
    expect(sliders[1]).toHaveAttribute('min', '0.1');
    expect(sliders[1]).toHaveAttribute('max', '3');
    expect(sliders[1]).toHaveAttribute('step', '0.01');
    // H = 0.5 m halves the rise time of the golden case.
    expect(valueOf('Tiempo de subida')).toBe('1.02 s');
  });

  test('es determinista: los mismos props dan el mismo panel', () => {
    const first = render(<PowerWidget initial={GOLDEN} initialTime_s={0.7} />);
    const html = screen.getByTestId('readout-panel').innerHTML;
    first.unmount();
    render(<PowerWidget initial={GOLDEN} initialTime_s={0.7} />);
    expect(screen.getByTestId('readout-panel').innerHTML).toBe(html);
  });
});
