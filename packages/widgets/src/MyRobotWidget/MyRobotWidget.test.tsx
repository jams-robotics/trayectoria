import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { parseRobotSpec, planar2dof, referenceMobile } from '@trayectoria/robot-spec';

import { $myRobot, configureMyRobotPersistence, resetMyRobot, setMyRobot } from '../stores/myRobot';
import { MyRobotWidget } from './MyRobotWidget';
import { omegaMax_radps, vMax_mps } from './fields';

beforeEach(() => {
  void configureMyRobotPersistence(null);
  resetMyRobot();
});

/** The `<label>` wrapper of one field of the form, addressed by its path in `MobileSpec`. */
function row(key: string): HTMLElement {
  const label = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
  if (label === null) throw new Error(`El formulario no tiene el campo ${key}`);
  return label;
}

/** The input of one field of the form. */
function field(key: string): HTMLElement {
  return within(row(key)).getByRole('textbox');
}

function type(key: string, value: string): void {
  fireEvent.change(field(key), { target: { value } });
}

const REFERENCE_MOBILE = (() => {
  const parsed = parseRobotSpec(referenceMobile);
  if (!parsed.ok || parsed.value.mobile === undefined) throw new Error('reference must be valid');
  return parsed.value.mobile;
})();

describe('MyRobotWidget derived values (F2-11)', () => {
  test('the reference robot gives ω_max = 20.944 rad/s and v_max = 0.670 m/s', () => {
    expect(omegaMax_radps(REFERENCE_MOBILE)).toBeCloseTo(20.944, 3);
    expect(vMax_mps(REFERENCE_MOBILE)).toBeCloseTo(0.67, 3);
  });

  test('the form shows both derived values read only', () => {
    render(<MyRobotWidget mode="form" />);

    expect(screen.getByTestId('derived-omegaMax')).toHaveTextContent('20.944 rad/s');
    expect(screen.getByTestId('derived-vMax')).toHaveTextContent('0.67 m/s');
  });
});

describe('MyRobotWidget form (F2-11)', () => {
  test('opens with every field of MobileSpec filled from the stored robot', () => {
    render(<MyRobotWidget mode="form" />);

    expect(screen.getByDisplayValue('Robot de referencia')).toBeInTheDocument();
    expect(field('wheelRadius_m')).toHaveValue('0.032');
    expect(field('lineSensors.count')).toHaveValue('5');
    expect(field('motor.efficiency')).toHaveValue('0.6');
    expect(field('battery.capacity_Wh')).toHaveValue('11.1');
  });

  test('saving a valid wheel radius publishes it and shows the toast', () => {
    render(<MyRobotWidget mode="form" />);

    type('wheelRadius_m', '0.05');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect($myRobot.get().mobile?.wheelRadius_m).toBe(0.05);
    expect(screen.getByTestId('toast')).toHaveTextContent('Parámetros de Mi robot aplicados');
    expect(screen.getByTestId('derived-vMax')).toHaveTextContent('1.047 m/s');
  });

  test('a wheel radius of 0.5 m shows the error and does not save', () => {
    render(<MyRobotWidget mode="form" />);

    type('wheelRadius_m', '0.5');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect($myRobot.get().mobile?.wheelRadius_m).toBe(0.032);
    expect(within(row('wheelRadius_m')).getByTestId('field-error')).toHaveTextContent(
      'Debe ser menor o igual que 0.3',
    );
    expect(field('wheelRadius_m')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'error');
  });

  test('blurring an out-of-range field reports it before saving', () => {
    render(<MyRobotWidget mode="form" />);

    type('wheelBase_m', '2');
    fireEvent.blur(field('wheelBase_m'));

    expect(within(row('wheelBase_m')).getByTestId('field-error')).toHaveTextContent(
      'Debe ser menor o igual que 1',
    );
    expect($myRobot.get().mobile?.wheelBase_m).toBe(0.15);
  });

  test('blurring a field back in range clears its error', () => {
    render(<MyRobotWidget mode="form" />);

    type('wheelBase_m', '2');
    fireEvent.blur(field('wheelBase_m'));
    type('wheelBase_m', '0.2');
    fireEvent.blur(field('wheelBase_m'));

    expect(within(row('wheelBase_m')).queryByTestId('field-error')).toBeNull();
  });

  test('«Restablecer al robot de referencia» brings the reference values back', () => {
    render(<MyRobotWidget mode="form" />);

    type('wheelRadius_m', '0.05');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Restablecer al robot de referencia' }),
    );

    expect($myRobot.get().mobile?.wheelRadius_m).toBe(0.032);
    expect(field('wheelRadius_m')).toHaveValue('0.032');
  });

  test('the name travels with the saved spec', () => {
    render(<MyRobotWidget mode="form" />);

    fireEvent.change(screen.getByDisplayValue('Robot de referencia'), {
      target: { value: 'Mi seguidor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect($myRobot.get().name).toBe('Mi seguidor');
  });

  test('an empty name is rejected and nothing is saved', () => {
    render(<MyRobotWidget mode="form" />);

    fireEvent.change(screen.getByDisplayValue('Robot de referencia'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect($myRobot.get().name).toBe('Robot de referencia');
    expect(screen.getByTestId('toast')).toHaveAttribute('data-tone', 'error');
  });

  test('clearing an optional field drops it instead of failing the parse', () => {
    render(<MyRobotWidget mode="form" />);

    type('battery.capacity_Wh', '');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect($myRobot.get().mobile?.battery).toBeUndefined();
  });

  test('the toast closes with Escape', () => {
    render(<MyRobotWidget mode="form" />);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByTestId('toast')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });
});

describe('MyRobotWidget card (F2-11)', () => {
  test('shows the name, the four figures and the link to the form', () => {
    render(<MyRobotWidget mode="card" />);

    expect(screen.getByTestId('my-robot-name')).toHaveTextContent('Robot de referencia');
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/cuenta');
    const figures = Array.from(document.querySelectorAll('[data-card-item]')).map((node) =>
      node.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(figures).toEqual([
      'Radio de rueda0.032 m',
      'Distancia entre ruedas0.15 m',
      'ω máxima de rueda20.944 rad/s',
      'Masa0.9 kg',
    ]);
  });

  test('`editHref` overrides where «Editar» points', () => {
    render(<MyRobotWidget mode="card" editHref="/cuenta/robot" />);

    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', '/cuenta/robot');
  });

  test('shows no figures for a spec without a `mobile` section', () => {
    const result = setMyRobot(planar2dof);
    expect(result.ok).toBe(true);

    render(<MyRobotWidget mode="card" />);

    expect(document.querySelectorAll('[data-card-item]')).toHaveLength(0);
  });

  test('follows the store when the form saves a new robot', () => {
    render(
      <>
        <MyRobotWidget mode="form" />
        <MyRobotWidget mode="card" />
      </>,
    );

    type('mass_kg', '1.4');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(document.querySelector('[data-card-item="mass_kg"]')).toHaveTextContent('1.4 kg');
  });
});
