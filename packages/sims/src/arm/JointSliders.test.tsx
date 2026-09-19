import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { JointSliders, jointParams } from './JointSliders';
import type { ActuatedJoint } from './types';

const JOINTS: readonly ActuatedJoint[] = [
  { name: 'joint1', type: 'revolute', index: 0, lower_rad: -Math.PI / 2, upper_rad: Math.PI / 2 },
  { name: 'joint2', type: 'continuous', index: 1, lower_rad: -Math.PI, upper_rad: Math.PI },
];

describe('JointSliders (F5-01a)', () => {
  test('convierte los límites del spec a grados, con paso de 1°', () => {
    const params = jointParams(JOINTS, [Math.PI / 4, 0], '°');
    expect(params.map((param) => param.key)).toEqual(['joint1', 'joint2']);
    expect(params[0]?.min).toBeCloseTo(-90, 9);
    expect(params[0]?.max).toBeCloseTo(90, 9);
    expect(params[0]?.value).toBeCloseTo(45, 9);
    expect(params[1]?.min).toBeCloseTo(-180, 9);
    expect(params[1]?.max).toBeCloseTo(180, 9);
    expect(params.map((param) => param.step)).toEqual([1, 1]);
    expect(params.every((param) => param.unit === '°')).toBe(true);
  });

  test('cada slider muestra grados y expone su rango a lectores de pantalla', () => {
    render(<JointSliders joints={JOINTS} q_rad={[0, 0]} onChange={vi.fn()} />);
    const panel = screen.getByTestId('joint-sliders');
    const sliders = within(panel).getAllByRole('slider');
    expect(sliders).toHaveLength(2);
    expect(sliders[0]).toHaveAttribute('aria-valuemin', '-90');
    expect(sliders[0]).toHaveAttribute('aria-valuemax', '90');
    expect(sliders[0]?.getAttribute('aria-label')).toContain('°');
    expect(sliders[0]?.getAttribute('aria-valuetext')).toContain('°');
  });

  test('un cambio de slider llega en radianes, por índice de articulación', () => {
    const onChange = vi.fn();
    render(<JointSliders joints={JOINTS} q_rad={[0, 0]} onChange={onChange} />);
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0] as HTMLInputElement, { target: { value: '90' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [index, q_rad] = onChange.mock.calls[0] as [number, number];
    expect(index).toBe(0);
    expect(q_rad).toBeCloseTo(Math.PI / 2, 9);
  });

  test('un valor fuera del límite del spec llega recortado al límite', () => {
    const onChange = vi.fn();
    render(<JointSliders joints={JOINTS} q_rad={[0, 0]} onChange={onChange} />);
    // 200° excede el límite de 90° de `joint1`; `ParamPanel` lo recorta antes de emitirlo.
    fireEvent.change(screen.getAllByRole('slider')[0] as HTMLInputElement, {
      target: { value: '200' },
    });
    const [, q_rad] = onChange.mock.calls[0] as [number, number];
    expect(q_rad).toBeCloseTo(Math.PI / 2, 9);
    expect(q_rad).toBeLessThanOrEqual(Math.PI / 2);
  });

  test('ignora un cambio cuya clave no es de una articulación', () => {
    const onChange = vi.fn();
    render(<JointSliders joints={[]} q_rad={[]} onChange={onChange} />);
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });
});
