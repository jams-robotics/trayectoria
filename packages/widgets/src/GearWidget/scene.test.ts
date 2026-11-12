import { describe, expect, it } from 'vitest';
import { t } from '@trayectoria/i18n';

import { WHEEL_RADIUS_M, pitchRadius_m } from './compute';
import type { Train } from './compute';
import { animationScale, directionOf, panelRows, statusOf } from './rows';
import { applyChange, paramsOf } from './panels';
import { drawnTeeth, trainLayout } from './train';

/** The «Explora» of T-4.4: the two stage train of the motor of the profile. */
const TRAIN: Train = {
  z1: 12,
  z2: 60,
  z3: 10,
  z4: 50,
  nIn_rpm: 6000,
  torqueIn_Nm: 0.012,
  efficiency: 0.6,
};

describe('dibujo del tren (F2-08)', () => {
  const dist = (a: readonly number[], b: readonly number[]): number =>
    Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0));

  it('los pares que engranan se tocan justo en el punto de paso: distancia r + r', () => {
    const { gears } = trainLayout(2, TRAIN, 0);

    expect(gears).toHaveLength(4);
    expect(dist(gears[0]?.centre_m ?? [], gears[1]?.centre_m ?? [])).toBeCloseTo(pitchRadius_m(12) + pitchRadius_m(60), 9);
    expect(dist(gears[2]?.centre_m ?? [], gears[3]?.centre_m ?? [])).toBeCloseTo(pitchRadius_m(10) + pitchRadius_m(50), 9);
  });

  it('z3 va en el eje de z2, debajo de ella: coaxiales y sin tocarse', () => {
    const { gears, shafts } = trainLayout(2, TRAIN, 0);
    const [, z2, z3] = gears;
    if (z2 === undefined || z3 === undefined) throw new Error('faltan z2 y z3');

    expect(z3.centre_m[0]).toBe(z2.centre_m[0]);
    expect(z2.centre_m[1] - z3.centre_m[1]).toBeGreaterThan(z2.radius_m + z3.radius_m);
    expect(shafts).toContainEqual([z2.centre_m, z3.centre_m]);
    // Same shaft, same turn: both advance the same angle.
    const later = trainLayout(2, TRAIN, 1).gears;
    const turned = (index: number): number => (later[index]?.angle_rad ?? 0) - (gears[index]?.angle_rad ?? 0);
    expect(turned(2)).toBeCloseTo(turned(1), 9);
  });

  it('los engranajes que no engranan no se solapan', () => {
    [TRAIN, { ...TRAIN, z2: 80, z3: 8, z4: 80 }, { ...TRAIN, z1: 8, z2: 8, z3: 80, z4: 8 }].forEach((train) => {
      const { gears } = trainLayout(2, train, 0);
      gears.forEach((a, i) =>
        gears.forEach((b, j) => {
          const meshes = (i === 0 && j === 1) || (i === 2 && j === 3);
          if (j <= i || meshes || (i === 1 && j === 2)) return;
          expect(dist(a.centre_m, b.centre_m)).toBeGreaterThan(a.radius_m + b.radius_m);
        }),
      );
    });
  });

  it('con una etapa solo hay dos engranajes y la rueda queda a la altura del de salida', () => {
    const layout = trainLayout(1, TRAIN, 0);

    expect(layout.gears).toHaveLength(2);
    expect(layout.wheel.centre_m[1]).toBe(layout.gears[1]?.centre_m[1]);
  });

  it('dibuja menos dientes que los reales, en proporción, y nunca menos de 6', () => {
    expect(drawnTeeth(60)).toBe(30);
    expect(drawnTeeth(12)).toBe(6);
    expect(drawnTeeth(8)).toBe(6);
  });

  it('los giros alternan de signo y van escalados (#91, decisión 4)', () => {
    const { gears } = trainLayout(2, TRAIN, 1);
    const start = trainLayout(2, TRAIN, 0).gears;
    const turned = (index: number): number => (gears[index]?.angle_rad ?? 0) - (start[index]?.angle_rad ?? 0);

    expect(gears.map((gear) => gear.spin)).toEqual([1, -1, -1, 1]);
    expect(turned(0)).toBeCloseTo(2 * Math.PI, 2);
    expect(turned(1)).toBeLessThan(0);
  });

  it('la cadena va de izquierda a derecha y la rueda se apoya en el suelo', () => {
    const { motor, gears, wheel, ground } = trainLayout(2, TRAIN, 0);
    const input = gears[0];
    const output = gears[3];
    if (input === undefined || output === undefined) throw new Error('falta un engranaje');

    expect(motor.centre_m[0]).toBeLessThan(input.centre_m[0] - input.radius_m);
    expect(wheel.centre_m[0]).toBeGreaterThan(output.centre_m[0] + output.radius_m);
    expect(ground.y_m).toBeCloseTo(wheel.centre_m[1] - WHEEL_RADIUS_M, 12);
  });

  it('el encuadre deja entrar todo y la fuerza empuja al contrario del contacto', () => {
    const layout = trainLayout(2, TRAIN, 0);
    const { view, motor, ground } = layout;
    const left = view.center_m[0] - view.worldWidth_m / 2;

    expect(motor.centre_m[0] - motor.width_m / 2).toBeGreaterThan(left);
    expect(ground.toX_m).toBeLessThan(left + view.worldWidth_m);
    // The output turns counter-clockwise in the two stage train, so the ground pushes to the left.
    expect(layout.pushDirection).toBe(-1);
    expect(trainLayout(1, TRAIN, 0).pushDirection).toBe(1);
  });

  it('el factor de animación nunca baja de 1', () => {
    expect(animationScale(6000)).toBeCloseTo(100, 9);
    expect(animationScale(30)).toBe(1);
  });
});

describe('panel y deslizadores (F2-08)', () => {
  it('una etapa muestra solo la relación total; dos etapas, una por etapa', () => {
    const terms = (stages: 1 | 2): readonly string[] =>
      panelRows(stages, TRAIN, t).map(([term]) => term);

    expect(terms(1)).not.toContain('Relación de la primera etapa');
    expect(terms(2)).toContain('Relación de la segunda etapa');
  });

  it('el sentido de salida se dice con texto, no solo con el signo', () => {
    expect(directionOf(1, t)).toBe('contrario a la entrada');
    expect(directionOf(2, t)).toBe('el mismo que la entrada');
    expect(statusOf(2, TRAIN, t)).toContain('el mismo que la entrada');
  });

  it('cada deslizador escribe su valor en el tren', () => {
    expect(applyChange(TRAIN, 'z1', 20).z1).toBe(20);
    expect(applyChange(TRAIN, 'z2', 20).z2).toBe(20);
    expect(applyChange(TRAIN, 'z3', 20).z3).toBe(20);
    expect(applyChange(TRAIN, 'z4', 20).z4).toBe(20);
    expect(applyChange(TRAIN, 'nIn', 3000).nIn_rpm).toBe(3000);
    expect(applyChange(TRAIN, 'torqueIn', 0.02).torqueIn_Nm).toBe(0.02);
    expect(applyChange(TRAIN, 'efficiency', 0.8).efficiency).toBe(0.8);
    // An unknown key does not touch the train.
    expect(applyChange(TRAIN, 'otra', 1)).toBe(TRAIN);
  });

  it('los deslizadores de velocidad y torque llevan su unidad', () => {
    const params = paramsOf(1, TRAIN, t);
    const unitOf = (key: string): string => params.find((param) => param.key === key)?.unit ?? '';

    expect(unitOf('nIn')).toBe('rpm');
    expect(unitOf('torqueIn')).toBe('N·m');
    expect(unitOf('z1')).toBe('');
  });
});
