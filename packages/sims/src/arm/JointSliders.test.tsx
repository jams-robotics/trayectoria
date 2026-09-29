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

  test('redondea un límite URDF no entero hacia dentro del rango real (#550)', () => {
    // -1.658 rad ≈ -94.99984°, 1.658 rad ≈ 94.99984°: the raw conversion the ticket found.
    const joints: readonly ActuatedJoint[] = [
      { name: 'joint1', type: 'revolute', index: 0, lower_rad: -1.658, upper_rad: 1.658 },
    ];
    const params = jointParams(joints, [0], '°');
    // Rounded inward (ceil the lower bound, floor the upper one), never past the real limit.
    expect(params[0]?.min).toBe(-94);
    expect(params[0]?.max).toBe(94);
  });

  test('golden (#535): los límites del SO-101 salen en grados enteros, sin decimales del URDF', () => {
    // wrist_roll [-2.74385, 2.84121] rad ≈ [-157.211025°, 162.789342°]; gripper upper
    // 1.74533 rad ≈ 100.000043° and lower -0.174533 rad ≈ -10.000004°: the figures the audit saw.
    const joints: readonly ActuatedJoint[] = [
      { name: 'wrist_roll', type: 'revolute', index: 0, lower_rad: -2.74385, upper_rad: 2.84121 },
      { name: 'gripper', type: 'revolute', index: 1, lower_rad: -0.174533, upper_rad: 1.74533 },
    ];
    const params = jointParams(joints, [0, 0], '°');
    expect(params.map((param) => [param.min, param.max])).toEqual([
      [-157, 162],
      [-10, 100],
    ]);
    expect(
      params.every((param) => Number.isInteger(param.min) && Number.isInteger(param.max)),
    ).toBe(true);
  });

  test('etiqueta legible de la ficha con el id URDF como texto auxiliar (#535)', () => {
    const labels = new Map([['joint1', 'Articulación 1']]);
    const params = jointParams(JOINTS, [0, 0], '°', labels);
    expect(params[0]?.label).toBe('Articulación 1');
    expect(params[0]?.description).toBe('joint1');
    // Without a readable label, the URDF id is the label and there is no auxiliary text.
    expect(params[1]?.label).toBe('joint2');
    expect(params[1]?.description).toBeUndefined();
    // The key stays the URDF id: it is what maps the slider back to its joint.
    expect(params.map((param) => param.key)).toEqual(['joint1', 'joint2']);
  });

  test('sin ficha, cada slider se llama como su articulación URDF', () => {
    const params = jointParams(JOINTS, [0, 0], '°');
    expect(params.map((param) => param.label)).toEqual(['joint1', 'joint2']);
    expect(params.every((param) => param.description === undefined)).toBe(true);
  });

  test('el título interno se marca para que la cabecera de un acordeón lo sustituya (#542)', () => {
    render(<JointSliders joints={JOINTS} q_rad={[0, 0]} onChange={vi.fn()} />);
    const title = screen.getByRole('heading', { name: 'Articulaciones' });
    expect(title).toHaveAttribute('data-panel-title');
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
    // 200° exceeds the 90° limit of `joint1`; `ParamPanel` clamps it before emitting it.
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
