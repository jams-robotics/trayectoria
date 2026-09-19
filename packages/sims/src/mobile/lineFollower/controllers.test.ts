import { describe, expect, it } from 'vitest';
import { REFERENCE_PID_PARAMS, maxWheelSpeed_radps } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { CONTROLLERS, CONTROLLER_IDS, controllerParams, isControllerId } from './controllers';

const SPEC = referenceMobile.mobile as MobileSpec;
const READING = { values: [0, 0, 1, 0, 0], linePosition: 0, lineLost: false } as const;
const STATE = {
  x_m: 0,
  y_m: 0,
  theta_rad: 0,
  v_mps: 0,
  omega_radps: 0,
  wheelAngleL_rad: 0,
  wheelAngleR_rad: 0,
  t_s: 0,
} as const;

describe('controllers (F4-02a)', () => {
  it('registra los cuatro controladores del selector', () => {
    expect(CONTROLLER_IDS).toEqual(['manual', 'onoff', 'p', 'pid']);
    for (const id of CONTROLLER_IDS) {
      expect(CONTROLLERS[id].id).toBe(id);
      expect(CONTROLLERS[id].labelKey).toBe(`sims.lineFollower.controller.${id}`);
    }
  });

  it('usa las ganancias de referencia de sim-core como defaults del PID', () => {
    expect(CONTROLLERS.pid.defaults).toEqual({ ...REFERENCE_PID_PARAMS });
  });

  it('manual manda la misma velocidad a las dos ruedas', () => {
    const controller = CONTROLLERS.manual.create({ omegaBase_radps: 10 });
    const command = controller.update(READING, STATE, 0.001);
    expect(command.omegaL_radps).toBe(10);
    expect(command.omegaR_radps).toBe(10);
    expect(command.omegaL_radps - command.omegaR_radps).toBe(0);
  });

  it('on/off corrige con signo fijo y P de forma proporcional al error', () => {
    const onoff = CONTROLLERS.onoff.create({ omegaBase_radps: 10, delta_radps: 3 });
    const right = onoff.update({ ...READING, linePosition: 0.2 }, STATE, 0.001);
    const left = onoff.update({ ...READING, linePosition: -0.9 }, STATE, 0.001);
    expect(right.omegaL_radps - right.omegaR_radps).toBeCloseTo(6, 12);
    expect(left.omegaL_radps - left.omegaR_radps).toBeCloseTo(-6, 12);

    const p = CONTROLLERS.p.create({ omegaBase_radps: 10, kp: 5 });
    const command = p.update({ ...READING, linePosition: 0.4 }, STATE, 0.001);
    expect(command.omegaL_radps - command.omegaR_radps).toBeCloseTo(4, 12);
  });

  it('el PID se construye con los parámetros dados y se reinicia', () => {
    const pid = CONTROLLERS.pid.create({ ...REFERENCE_PID_PARAMS });
    const first = pid.update({ ...READING, linePosition: 0.5 }, STATE, 0.001);
    pid.reset();
    const afterReset = pid.update({ ...READING, linePosition: 0.5 }, STATE, 0.001);
    expect(afterReset).toEqual(first);
  });

  it('describe los parámetros del panel con rangos y valores actuales', () => {
    const params = controllerParams('pid', { ...REFERENCE_PID_PARAMS }, SPEC, (key) => key);
    const keys = params.map((param) => param.key);
    expect(keys).toEqual(['omegaBase_radps', 'kp', 'ki', 'kd', 'iMax']);
    const omegaBase = params[0];
    expect(omegaBase?.value).toBe(REFERENCE_PID_PARAMS.omegaBase_radps);
    expect(omegaBase?.max).toBeCloseTo(maxWheelSpeed_radps(SPEC), 9);
    expect(params.find((param) => param.key === 'kp')?.max).toBe(20);
    expect(params.find((param) => param.key === 'ki')?.max).toBe(10);
    expect(params.find((param) => param.key === 'kd')?.max).toBe(5);
  });

  it('solo describe los parámetros del controlador pedido', () => {
    const manual = controllerParams('manual', CONTROLLERS.manual.defaults, SPEC, (key) => key);
    expect(manual.map((param) => param.key)).toEqual(['omegaBase_radps']);
    const onoff = controllerParams('onoff', CONTROLLERS.onoff.defaults, SPEC, (key) => key);
    expect(onoff.map((param) => param.key)).toEqual(['omegaBase_radps', 'delta_radps']);
    const proportional = controllerParams('p', CONTROLLERS.p.defaults, SPEC, (key) => key);
    expect(proportional.map((param) => param.key)).toEqual(['omegaBase_radps', 'kp']);
  });

  it('completa los parámetros que falten con los defaults del controlador', () => {
    const params = controllerParams('p', {}, SPEC, (key) => key);
    expect(params.find((param) => param.key === 'kp')?.value).toBe(CONTROLLERS.p.defaults.kp);
  });

  it('reconoce los identificadores válidos de controlador', () => {
    expect(isControllerId('pid')).toBe(true);
    expect(isControllerId('custom')).toBe(false);
  });
});
