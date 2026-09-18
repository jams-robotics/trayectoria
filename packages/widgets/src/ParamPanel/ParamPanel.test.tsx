import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { ParamPanel } from './ParamPanel';
import type { ParamPanelParam } from './ParamPanel';

// F2-01a: behaviour of the Slider of docs/DESIGN.md §5 rendered by ParamPanel.
const KP: ParamPanelParam = {
  key: 'kp',
  label: 'Ganancia proporcional',
  unit: 'rad/s',
  min: 0,
  max: 10,
  step: 0.5,
  value: 4,
};

function renderPanel(params: readonly ParamPanelParam[] = [KP]): {
  onChange: ReturnType<typeof vi.fn>;
} {
  const onChange = vi.fn();
  render(<ParamPanel params={params} onChange={onChange} />);
  return { onChange };
}

describe('F2-01a ParamPanel', () => {
  test('renders one slider and one numeric field per parameter, both with aria-label', () => {
    renderPanel();
    expect(
      screen.getByRole('slider', { name: 'Ganancia proporcional en rad/s' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Valor de Ganancia proporcional' }),
    ).toBeInTheDocument();
  });

  test('the slider exposes aria-valuenow/min/max and aria-valuetext with the unit', () => {
    renderPanel();
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '4');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '10');
    expect(slider).toHaveAttribute('aria-valuetext', '4 rad/s');
  });

  test('describes the state in an aria-live region', () => {
    renderPanel();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Ganancia proporcional: 4 rad/s');
  });

  test('right arrow adds one step', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('kp', 4.5);
  });

  test('left arrow subtracts one step', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('kp', 3.5);
  });

  test('shift+arrow moves ten steps', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();
    await user.tab();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(onChange).toHaveBeenLastCalledWith('kp', 9);
  });

  test('shift+arrow clamps to max instead of overshooting', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel([{ ...KP, value: 8 }]);
    await user.tab();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(onChange).toHaveBeenLastCalledWith('kp', 10);
  });

  test('arrow keys clamp to min', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel([{ ...KP, value: 0 }]);
    await user.tab();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('kp', 0);
  });

  test('dragging the slider emits the value snapped to the step', () => {
    const { onChange } = renderPanel();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '6.4' } });
    expect(onChange).toHaveBeenLastCalledWith('kp', 6.5);
  });

  test('typing a value above max and pressing Enter emits max', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();
    const field = screen.getByRole('textbox', { name: 'Valor de Ganancia proporcional' });
    await user.clear(field);
    await user.type(field, '99{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('kp', 10);
  });

  test('typing a value below min and pressing Enter emits min', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();
    const field = screen.getByRole('textbox', { name: 'Valor de Ganancia proporcional' });
    await user.clear(field);
    await user.type(field, '-4{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('kp', 0);
  });

  test('typing a value between steps rounds it to the step', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();
    const field = screen.getByRole('textbox', { name: 'Valor de Ganancia proporcional' });
    await user.clear(field);
    await user.type(field, '4.3{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('kp', 4.5);
  });

  test('rounding to the step is anchored at min', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel([{ ...KP, min: 0.2, step: 0.5 }]);
    const field = screen.getByRole('textbox', { name: 'Valor de Ganancia proporcional' });
    await user.clear(field);
    await user.type(field, '1.5{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('kp', 1.7);
  });

  test('a value that is not a number restores the current value and emits nothing', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();
    const field = screen.getByRole('textbox', { name: 'Valor de Ganancia proporcional' });
    await user.clear(field);
    await user.type(field, 'abc{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue('4');
  });

  test('leaving the field applies the typed value without Enter', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();
    const field = screen.getByRole('textbox', { name: 'Valor de Ganancia proporcional' });
    await user.clear(field);
    await user.type(field, '7');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith('kp', 7);
  });

  test('Escape cancels the edit and emits nothing', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();
    const field = screen.getByRole('textbox', { name: 'Valor de Ganancia proporcional' });
    await user.clear(field);
    await user.type(field, '9{Escape}');
    expect(onChange).not.toHaveBeenCalled();
    expect(field).toHaveValue('4');
  });

  test('arrow keys in the numeric field move by step and by ten steps with shift', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();
    const field = screen.getByRole('textbox', { name: 'Valor de Ganancia proporcional' });
    await user.click(field);
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith('kp', 4.5);
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(onChange).toHaveBeenLastCalledWith('kp', 0);
  });

  test('shows the parameter description and the range under the track', () => {
    renderPanel([{ ...KP, description: 'Corrige el error de línea' }]);
    expect(screen.getByText('Corrige el error de línea')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  test('the layout defaults to stack and switches to inline', () => {
    const { container } = render(<ParamPanel params={[KP]} onChange={vi.fn()} />);
    expect(container.querySelector('[data-layout="stack"]')).not.toBeNull();
    const inline = render(<ParamPanel params={[KP]} onChange={vi.fn()} layout="inline" />);
    expect(inline.container.querySelector('[data-layout="inline"]')).not.toBeNull();
  });

  test('renders every parameter of the list', () => {
    renderPanel([KP, { ...KP, key: 'kd', label: 'Ganancia derivativa', value: 1 }]);
    expect(screen.getAllByRole('slider')).toHaveLength(2);
  });
});
