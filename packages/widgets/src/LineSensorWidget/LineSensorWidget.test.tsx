import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { LineSensorWidget } from './LineSensorWidget';

/** The value of one row of the values panel, by the text of its term. */
function valueOf(term: string): string {
  const panel = screen.getByTestId('readout-panel');
  return within(panel).getByText(term).nextElementSibling?.textContent ?? '';
}

/** The figures under the five bars, `v_0` to `v_4`. */
function readings(): readonly string[] {
  return [0, 1, 2, 3, 4].map((k) => screen.getByTestId(`v-${String(k)}`).textContent ?? '');
}

/** The slider whose accessible name starts with `label`. */
function sliderFor(label: string): HTMLElement {
  return screen.getByRole('slider', { name: new RegExp(`^${label}`) });
}

function slide(label: string, value: number): void {
  fireEvent.change(sliderFor(label), { target: { value: String(value) } });
}

describe('LineSensorWidget (T-6.1)', () => {
  test('offset 0 → v = [0, 0.5, 1, 0.5, 0] and p = 0 with the reference robot', () => {
    render(<LineSensorWidget initialOffset_m={0} />);

    expect(readings()).toEqual(['0.00', '0.50', '1.00', '0.50', '0.00']);
    expect(valueOf('Posición p')).toBe('0.000');
    expect(valueOf('Índice ponderado k̄')).toBe('2.00');
    expect(screen.queryByTestId('line-lost')).toBeNull();
  });

  test('0.006 m to the left → [0, 1, 1, 0, 0], p = −0.25, y_línea = −0.006 m', () => {
    render(<LineSensorWidget initialOffset_m={0.006} />);

    expect(readings()).toEqual(['0.00', '1.00', '1.00', '0.00', '0.00']);
    expect(valueOf('Posición p')).toBe('-0.250');
    expect(valueOf('Desplazamiento y_línea')).toBe('-0.0060 m');
  });

  test('sliding the line to the left makes p negative', () => {
    render(<LineSensorWidget initialOffset_m={0} />);

    slide('Desplazamiento de la línea', 0.01);

    expect(valueOf('Posición p').startsWith('-')).toBe(true);
  });

  test('past 0.036 m the line is lost and p keeps the last sign', () => {
    render(<LineSensorWidget initialOffset_m={0.036} />);
    expect(screen.queryByTestId('line-lost')).toBeNull();

    slide('Desplazamiento de la línea', 0.04);

    expect(screen.getByTestId('line-lost')).toHaveTextContent('Línea perdida');
    expect(valueOf('Posición p')).toBe('-1.000');
  });

  test('showBinary shows b_k with the threshold u = 0.5, and the threshold slider moves it', () => {
    render(<LineSensorWidget initialOffset_m={0} showBinary />);

    expect(screen.getByTestId('b-1')).toHaveTextContent('b_1 = 1');
    slide('Umbral u', 0.6);
    expect(screen.getByTestId('b-1')).toHaveTextContent('b_1 = 0');
    expect(screen.getByTestId('b-2')).toHaveTextContent('b_2 = 1');
  });

  test('without showBinary there is no binary reading', () => {
    render(<LineSensorWidget initialOffset_m={0} />);

    expect(screen.queryByTestId('b-0')).toBeNull();
  });

  test('the sliders follow the ranges of docs/WIDGETS.md and the initial props', () => {
    render(<LineSensorWidget initialOffset_m={0.01} initialAngle_rad={0.2} noiseSigma={0.03} />);

    const offset = sliderFor('Desplazamiento de la línea');
    expect(offset).toHaveAttribute('min', '-0.05');
    expect(offset).toHaveAttribute('max', '0.05');
    expect(offset).toHaveAttribute('step', '0.001');
    expect(offset).toHaveValue('0.01');
    const angle = sliderFor('Ángulo de la línea');
    expect(angle).toHaveAttribute('min', '-0.5');
    expect(angle).toHaveAttribute('max', '0.5');
    expect(angle).toHaveValue('0.2');
    const noise = sliderFor('Ruido σ');
    expect(noise).toHaveAttribute('max', '0.2');
    expect(noise).toHaveAttribute('step', '0.01');
    expect(noise).toHaveValue('0.03');
    const threshold = sliderFor('Umbral u');
    expect(threshold).toHaveAttribute('min', '0.1');
    expect(threshold).toHaveAttribute('max', '0.9');
    expect(threshold).toHaveAttribute('step', '0.05');
    expect(threshold).toHaveValue('0.5');
  });

  test('with noise, «Paso» moves the widget time and a new sample arrives every 0.1 s', () => {
    render(<LineSensorWidget initialOffset_m={0} noiseSigma={0.2} />);
    const first = readings();
    const step = screen.getByRole('button', { name: /Paso/ });

    for (let i = 0; i < 5; i += 1) act(() => step.click());
    expect(readings()).toEqual(first);
    for (let i = 0; i < 5; i += 1) act(() => step.click());
    expect(readings()).not.toEqual(first);
  });

  test('every control has an accessible name and the state is announced', () => {
    render(<LineSensorWidget initialOffset_m={0} />);

    for (const slider of screen.getAllByRole('slider')) {
      expect(slider).toHaveAccessibleName();
    }
    const sentences = screen.getAllByRole('status').map((node) => node.textContent);
    expect(sentences).toContain('La línea está en p = 0.000, a 0.0000 m del centro del arreglo');
  });
});
