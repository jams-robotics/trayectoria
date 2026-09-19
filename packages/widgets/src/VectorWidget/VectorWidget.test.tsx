import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { VectorWidget } from './VectorWidget';

/** Props of the «Explora» of T-0.2 (docs/CURRICULUM.md), the case the story captures. */
function renderCurriculum(): void {
  render(
    <VectorWidget
      initialA={[0.433, 0.25]}
      initialB={[0.2, -0.1]}
      show={['components', 'sum', 'angle', 'dot']}
      unit="m/s"
    />,
  );
}

/** The value of one row of the values panel, by the text of its term. */
function valueOf(term: string): string {
  const panel = screen.getByTestId('readout-panel');
  const dt = within(panel).getByText(term);
  return dt.nextElementSibling?.textContent ?? '';
}

describe('VectorWidget (F2-03)', () => {
  test('shows the components, magnitude and angle of T-0.2 for the initial vectors', () => {
    renderCurriculum();

    expect(valueOf('Componentes de a')).toBe('(0.433 m/s, 0.250 m/s)');
    expect(valueOf('Magnitud de a')).toBe('0.500 m/s');
    expect(valueOf('Ángulo de a')).toBe('30.00°');
  });

  test('shows the sum, the dot product and the angle between the two vectors', () => {
    renderCurriculum();

    expect(valueOf('Componentes de a + b')).toBe('(0.633 m/s, 0.150 m/s)');
    expect(valueOf('Magnitud de a + b')).toBe('0.651 m/s');
    expect(valueOf('Producto escalar a · b')).toBe('0.0616 (m/s)²');
    expect(valueOf('Ángulo entre a y b')).toBe('56.57°');
  });

  test('a keyboard arrow moves a tip by 0.1 and updates magnitude and angle', async () => {
    const user = userEvent.setup();
    render(<VectorWidget initialA={[0.3, 0.4]} show={['components', 'angle']} unit="m" />);

    expect(valueOf('Magnitud de a')).toBe('0.500 m');
    expect(valueOf('Ángulo de a')).toBe('53.13°');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Punta del vector a' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');

    expect(valueOf('Componentes de a')).toBe('(0.400 m, 0.400 m)');
    expect(valueOf('Magnitud de a')).toBe('0.566 m');
    expect(valueOf('Ángulo de a')).toBe('45.00°');
  });

  test('Shift and an arrow move a tip by 1.0 instead of 0.1', async () => {
    const user = userEvent.setup();
    render(<VectorWidget initialA={[0.3, 0.4]} show={['components']} unit="m" />);

    screen.getByRole('button', { name: 'Punta del vector a' }).focus();
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');

    expect(valueOf('Componentes de a')).toBe('(0.300 m, 1.40 m)');
  });

  test('the four arrows move the tip in the four directions of the world', async () => {
    const user = userEvent.setup();
    render(<VectorWidget initialA={[0.5, 0.5]} show={['components']} unit="m" />);

    const tip = screen.getByRole('button', { name: 'Punta del vector a' });
    tip.focus();
    await user.keyboard('{ArrowLeft}{ArrowDown}');

    expect(valueOf('Componentes de a')).toBe('(0.400 m, 0.400 m)');
  });

  test('both tips are focusable controls with a translated name', () => {
    renderCurriculum();

    const handles = screen.getAllByRole('button');
    expect(handles.map((handle) => handle.getAttribute('aria-label'))).toEqual([
      'Punta del vector a',
      'Punta del vector b',
    ]);
  });

  test('`show` selects what the panel lists: without `dot` and `angle` neither appears', () => {
    render(<VectorWidget initialA={[0.3, 0.4]} show={['components']} unit="m" />);

    expect(screen.queryByText('Producto escalar a · b')).not.toBeInTheDocument();
    expect(screen.queryByText('Ángulo entre a y b')).not.toBeInTheDocument();
    expect(screen.queryByText('Magnitud de a + b')).not.toBeInTheDocument();
    expect(screen.getByText('Magnitud de a')).toBeInTheDocument();
  });

  test('describes its state in an `aria-live` region and names the scene', () => {
    renderCurriculum();

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Dos vectores arrastrables desde el origen, con su suma',
    );
  });

  test('b defaults to the zero vector when the topic gives only a', () => {
    render(<VectorWidget initialA={[0.3, 0.4]} show={['sum', 'angle']} unit="m" />);

    expect(valueOf('Magnitud de b')).toBe('0.00 m');
    expect(valueOf('Magnitud de a + b')).toBe('0.500 m');
    // The zero vector has no direction, so the angle against it is reported as zero, not NaN.
    expect(valueOf('Ángulo entre a y b')).toBe('0.00°');
  });
});
