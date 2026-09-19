import { describe, expect, it } from 'vitest';

import {
  PATH_PERIOD_S,
  TRACE_PERIOD_S,
  flightTime,
  initialVelocity,
  maxHeight,
  positionAt,
  range,
  robotPositionAt,
  samplePath,
  speedAt,
  traceDots,
  velocityAt,
  worldWidthOf,
} from './compute';
import type { Launch } from './compute';

/** Absolute tolerance of the golden values of the ticket (#88, decision 2). */
const TOL = 1e-3;

/** The drop of T-1.3: the gripper lets a part go from 0.25 m with no initial velocity. */
const DROP: Launch = { v0_mps: 0, launchAngle_rad: 0, h_m: 0.25, vRobot_mps: 0 };
/** The launch of the «Explora» of T-1.4: 4 m/s at 40° from 0.3 m. */
const LAUNCH: Launch = {
  v0_mps: 4,
  launchAngle_rad: (40 * Math.PI) / 180,
  h_m: 0.3,
  vRobot_mps: 0,
};

describe('caída libre (F2-05)', () => {
  it('desde h = 0.25 m cae en 0.2258 s y llega a 2.215 m/s (T-1.3)', () => {
    const t_s = flightTime('drop', DROP);
    expect(t_s).toBeCloseTo(0.2258, 3);
    expect(Math.abs(t_s - 0.2258)).toBeLessThanOrEqual(TOL);
    const v_mps = speedAt('drop', DROP, t_s);
    expect(v_mps).toBeCloseTo(2.215, 3);
    expect(Math.abs(v_mps - 2.215)).toBeLessThanOrEqual(TOL);
  });

  it('tras t = 0.4 s ha caído 0.7848 m (e3 de T-1.3)', () => {
    const fallen_m = DROP.h_m - positionAt('drop', DROP, 0.4)[1];
    expect(fallen_m).toBeCloseTo(0.7848, 4);
  });

  it('cuadruplicar h sólo duplica el tiempo de caída (experimento 1 de T-1.3)', () => {
    const quadruple = flightTime('drop', { ...DROP, h_m: 4 * DROP.h_m });
    expect(quadruple).toBeCloseTo(2 * flightTime('drop', DROP), 12);
  });

  it('en caída libre la velocidad es vertical y el alcance es nulo', () => {
    expect(initialVelocity('drop', DROP)).toEqual([0, 0]);
    expect(velocityAt('drop', DROP, 0.1)[0]).toBe(0);
    expect(range('drop', DROP)).toBe(0);
    expect(maxHeight('drop', DROP)).toBeCloseTo(0.25, 12);
  });
});

describe('tiro parabólico (F2-05)', () => {
  it('v0 = 4 m/s, α = 40°, h = 0: alcance 1.606 m (e1 de T-1.4)', () => {
    const flat: Launch = { ...LAUNCH, h_m: 0 };
    expect(Math.abs(range('launch', flat) - 1.606)).toBeLessThanOrEqual(TOL);
  });

  it('v0 = 4 m/s, α = 40°, h = 0.3: H = 0.6369 m, t_v = 0.6224 s y R = 1.907 m (T-1.4)', () => {
    expect(Math.abs(maxHeight('launch', LAUNCH) - 0.6369)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(flightTime('launch', LAUNCH) - 0.6224)).toBeLessThanOrEqual(TOL);
    expect(Math.abs(range('launch', LAUNCH) - 1.907)).toBeLessThanOrEqual(TOL);
  });

  it('30° y 60° con h = 0 dan el mismo alcance (experimento 2 de T-1.4)', () => {
    const at = (deg: number): number =>
      range('launch', { ...LAUNCH, h_m: 0, launchAngle_rad: (deg * Math.PI) / 180 });
    expect(at(30)).toBeCloseTo(at(60), 12);
  });

  it('v_x no cambia en todo el vuelo mientras v_y baja con −g (experimento 3 de T-1.4)', () => {
    const [vx0_mps] = velocityAt('launch', LAUNCH, 0);
    for (let t_s = 0; t_s <= flightTime('launch', LAUNCH); t_s += 0.05) {
      const [vx_mps, vy_mps] = velocityAt('launch', LAUNCH, t_s);
      expect(vx_mps).toBeCloseTo(vx0_mps, 12);
      expect(vy_mps).toBeCloseTo(LAUNCH.v0_mps * Math.sin(LAUNCH.launchAngle_rad) - 9.81 * t_s, 12);
    }
  });

  it('en el instante de altura máxima v_y es cero', () => {
    const vy0_mps = LAUNCH.v0_mps * Math.sin(LAUNCH.launchAngle_rad);
    const apex_s = vy0_mps / 9.81;
    expect(velocityAt('launch', LAUNCH, apex_s)[1]).toBeCloseTo(0, 12);
    expect(positionAt('launch', LAUNCH, apex_s)[1]).toBeCloseTo(maxHeight('launch', LAUNCH), 12);
  });
});

describe('suelta desde un robot en movimiento (F2-05)', () => {
  /** e4 de T-1.3: el robot avanza a 0.5 m/s y suelta desde 0.25 m. */
  const SLOW: Launch = { v0_mps: 0, launchAngle_rad: 0, h_m: 0.25, vRobot_mps: 0.5 };
  /** e5 de T-1.4: el robot avanza a 0.6 m/s y suelta desde 0.25 m. */
  const FAST: Launch = { ...SLOW, vRobot_mps: 0.6 };

  it('a 0.5 m/s desde 0.25 m el adelanto es 0.1129 m (e4 de T-1.3)', () => {
    expect(Math.abs(range('dropFromRobot', SLOW) - 0.1129)).toBeLessThanOrEqual(TOL);
  });

  it('a 0.6 m/s desde 0.25 m el adelanto es 0.1355 m (e5 de T-1.4)', () => {
    expect(Math.abs(range('dropFromRobot', FAST) - 0.1355)).toBeLessThanOrEqual(TOL);
  });

  it('la pieza cae siempre sobre la vertical del robot, en 10 instantes', () => {
    const t_v = flightTime('dropFromRobot', FAST);
    for (let index = 0; index < 10; index++) {
      const t_s = (index * t_v) / 9;
      expect(positionAt('dropFromRobot', FAST, t_s)[0]).toBeCloseTo(
        robotPositionAt(FAST, t_s),
        12,
      );
    }
  });

  it('hereda v_x del robot y ninguna velocidad vertical (T-1.4)', () => {
    expect(initialVelocity('dropFromRobot', FAST)).toEqual([0.6, 0]);
    expect(maxHeight('dropFromRobot', FAST)).toBeCloseTo(0.25, 12);
    // El tiempo de caída no depende de v_x: es el mismo que soltándola en reposo.
    expect(flightTime('dropFromRobot', FAST)).toBeCloseTo(flightTime('drop', DROP), 12);
  });
});

describe('muestreo y encuadre (F2-05)', () => {
  it('muestrea la trayectoria en [0, t_v], extremos incluidos y aterrizando en y = 0', () => {
    const t_v = flightTime('launch', LAUNCH);
    const points = samplePath('launch', LAUNCH, t_v, PATH_PERIOD_S);
    expect(points.length).toBe(Math.round(t_v / PATH_PERIOD_S) + 1);
    expect(points[0]).toEqual([0, LAUNCH.h_m]);
    expect(points.at(-1)?.[1]).toBeCloseTo(0, 12);
    expect(points.at(-1)?.[0]).toBeCloseTo(range('launch', LAUNCH), 12);
  });

  it('deja una marca cada 0.1 s hasta el instante actual', () => {
    const dots = traceDots('launch', LAUNCH, 0.35);
    expect(TRACE_PERIOD_S).toBe(0.1);
    expect(dots.length).toBe(4);
    const [x_m, y_m] = positionAt('launch', LAUNCH, 3 * TRACE_PERIOD_S);
    expect(dots[3]?.[0]).toBeCloseTo(x_m, 12);
    expect(dots[3]?.[1]).toBeCloseTo(y_m, 12);
    expect(traceDots('launch', LAUNCH, 0)).toEqual([[0, LAUNCH.h_m]]);
  });

  it('encuadra el alcance más ancho con un 15 % de margen y al menos 1 m', () => {
    expect(worldWidthOf([2, 1.5])).toBeCloseTo(2.3, 12);
    expect(worldWidthOf([0.1])).toBeCloseTo(1.15, 12);
  });
});
