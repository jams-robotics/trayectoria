import { describe, expect, it } from 'vitest';
import { t } from '@trayectoria/i18n';

import { pitchRadius_m } from './compute';
import type { Train } from './compute';
import { animationScale, directionOf, panelRows, statusOf } from './rows';
import { applyChange, paramsOf } from './panels';
import { drawnGears, labelAnchor, sceneCentre, toothPolygon, worldWidthOf } from './scene';

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

/** Labels of the four gears, as the widget hands them to the scene. */
const LABELS = ['z1 = 12', 'z2 = 60', 'z3 = 10', 'z4 = 50'] as const;

describe('dibujo del tren (F2-08)', () => {
  it('cada engranaje es un polígono cerrado con z dientes (#91, decisión 3)', () => {
    const points = toothPolygon([0, 0], 0.012, 12, 0);

    // Cuatro vértices por diente, más el punto de cierre.
    expect(points).toHaveLength(12 * 4 + 1);
    expect(points[points.length - 1]).toEqual(points[0]);
  });

  it('un engranaje sin dientes sigue dibujando un contorno', () => {
    expect(toothPolygon([0, 0], 0.012, 0, 0).length).toBeGreaterThan(1);
  });

  it('los centros están separados por la suma de radios (#91, decisión 3)', () => {
    const gears = drawnGears(2, TRAIN, 0, LABELS);

    expect(gears).toHaveLength(4);
    expect(gears[1]?.centre_m[0]).toBeCloseTo(pitchRadius_m(12) + pitchRadius_m(60), 9);
    // z3 comparte el eje de z2, así que comparte su centro y su ángulo.
    expect(gears[2]?.centre_m).toEqual(gears[1]?.centre_m);
    expect(gears[2]?.angle_rad).toBe(gears[1]?.angle_rad);
    // La segunda etapa engrana en diagonal, pero a la distancia exacta r3 + r4 (#91, decisión 3).
    const dx_m = (gears[3]?.centre_m[0] ?? 0) - (gears[1]?.centre_m[0] ?? 0);
    const dy_m = (gears[3]?.centre_m[1] ?? 0) - (gears[1]?.centre_m[1] ?? 0);
    expect(Math.hypot(dx_m, dy_m)).toBeCloseTo(pitchRadius_m(10) + pitchRadius_m(50), 9);
    expect(dy_m).toBeLessThan(0);
  });

  it('con z2 = z3 los dos engranajes del eje compartido se distinguen (#348)', () => {
    const train: Train = { ...TRAIN, z2: 60, z3: 60 };
    const gears = drawnGears(2, train, 0.3, LABELS);
    const z2 = gears[1];
    const z3 = gears[2];
    if (z2 === undefined || z3 === undefined) throw new Error('faltan z2 y z3');

    // Mismo eje y misma velocidad, pero los dientes de z3 caen en los huecos de z2.
    expect(z3.centre_m).toEqual(z2.centre_m);
    expect(z3.angle_rad - z2.angle_rad).toBeCloseTo(Math.PI / 60, 9);
    // z3 lleva un aro propio y su etiqueta al otro lado del ancla, para no tapar la de z2.
    expect(z3.ring).toBe(true);
    expect(z2.ring).toBe(false);
    expect(z3.labelAlign).toBe('left');
    expect(z2.labelAlign).toBe('right');
  });

  it('si z2 y z3 no se solapan, el dibujo no cambia (#348)', () => {
    const gears = drawnGears(2, TRAIN, 0.3, LABELS);

    expect(gears[2]?.angle_rad).toBe(gears[1]?.angle_rad);
    gears.forEach((gear) => {
      expect(gear.ring).toBe(false);
      expect(gear.labelAlign).toBe('right');
    });
  });

  it('con una etapa solo hay dos engranajes', () => {
    expect(drawnGears(1, TRAIN, 0, LABELS)).toHaveLength(2);
  });

  it('los ángulos dibujados alternan de signo y van escalados (#91, decisión 4)', () => {
    const gears = drawnGears(2, TRAIN, 1, LABELS);

    expect(gears[0]?.angle_rad).toBeGreaterThan(0);
    expect(gears[1]?.angle_rad).toBeLessThan(0);
    expect(gears[3]?.angle_rad).toBeGreaterThan(0);
    // 6000 rpm son 100 vueltas/s, así que el de entrada da una vuelta por segundo dibujada.
    expect(gears[0]?.angle_rad).toBeCloseTo(2 * Math.PI, 2);
  });

  it('el ancho del mundo cubre el tren con margen y la vista se centra en él', () => {
    const gears = drawnGears(2, TRAIN, 0, LABELS);
    const span_m = (gears[3]?.centre_m[0] ?? 0) + (gears[3]?.radius_m ?? 0);

    expect(worldWidthOf(gears)).toBeGreaterThan(span_m);
    expect(sceneCentre(gears)[0]).toBeGreaterThan(0);
    // La segunda etapa baja, así que el centro de la vista también baja.
    expect(sceneCentre(gears)[1]).toBeLessThan(0);
  });

  it('el encuadre deja entrar el tren entero también a lo alto', () => {
    const gears = drawnGears(2, TRAIN, 0, LABELS);
    const height_m = worldWidthOf(gears) / (16 / 9);
    const top_m = Math.max(...gears.map(({ centre_m, radius_m }) => centre_m[1] + radius_m));
    const bottom_m = Math.min(...gears.map(({ centre_m, radius_m }) => centre_m[1] - radius_m));

    expect(height_m).toBeGreaterThan(top_m - bottom_m);
  });

  it('cada etiqueta queda fuera de su corona y alejada del centro de la vista', () => {
    const gears = drawnGears(2, TRAIN, 0, LABELS);
    const centre_m = sceneCentre(gears);

    gears.forEach((gear) => {
      const at_m = labelAnchor(gear, centre_m);
      const toGear_m = Math.hypot(at_m[0] - gear.centre_m[0], at_m[1] - gear.centre_m[1]);
      expect(toGear_m).toBeGreaterThan(gear.radius_m);
      // Se aleja del centro de la vista, no se acerca.
      const before_m = Math.hypot(gear.centre_m[0] - centre_m[0], gear.centre_m[1] - centre_m[1]);
      expect(Math.hypot(at_m[0] - centre_m[0], at_m[1] - centre_m[1])).toBeGreaterThan(before_m);
    });
  });

  it('un engranaje en el centro exacto de la vista etiqueta por encima de su corona', () => {
    const gears = drawnGears(1, TRAIN, 0, LABELS);
    const gear = gears[0];
    if (gear === undefined) throw new Error('falta el engranaje de entrada');

    expect(labelAnchor(gear, gear.centre_m)).toEqual([
      gear.centre_m[0],
      gear.centre_m[1] + gear.radius_m,
    ]);
  });

  it('un tren vacío no deja el mundo en cero', () => {
    expect(worldWidthOf([])).toBeGreaterThan(0);
    expect(sceneCentre([])).toEqual([0, 0]);
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
    // Una clave desconocida no toca el tren.
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
