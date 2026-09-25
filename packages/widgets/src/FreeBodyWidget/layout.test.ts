import { describe, expect, test } from 'vitest';
import { degToRad } from '@trayectoria/sim-core';
import type { Vec2 } from '@trayectoria/sim-core';

import { readFreeBody } from './compute';
import type { ForceInput } from './compute';
import {
  LABEL_HEIGHT_PX,
  M_PER_N,
  MAX_ARROW_M,
  VIEW_ASPECT,
  VIEW_WIDTH_M,
  arrowTips_m,
  placeLabels,
} from './layout';
import type { LabelBox } from './layout';

/** Extremes of every slider range of the widget (params.ts and FreeBodyWidget.tsx, #305). */
const MASSES_KG = [0.2, 3];
const SLOPES_DEG = [0, 45];
const MU_S = [undefined, 0.1, 1];
const MAGNITUDES_N = [0, 10];
const ANGLES_DEG = [-180, -90, 0, 90, 180];

/** Half extents of the visible view, in metres of the scene. */
const HALF_WIDTH_M = VIEW_WIDTH_M / 2;
const HALF_HEIGHT_M = VIEW_WIDTH_M / VIEW_ASPECT / 2;

/** Labels as the Spanish catalogue names them; the longest one is the rolling friction. */
const LABELS = ['Tracción', 'Fricción de rodadura', 'Peso', 'Normal', 'R'];
/** Advance of one glyph of the 11 px monospace font, rounded up, in CSS pixels. */
const CHAR_PX = 7;

interface Case {
  mass_kg: number;
  slope_rad: number;
  mu_s: number | undefined;
  forces: ForceInput[];
}

/** Every combination of the extremes: two editable forces, as in the «Explora» of T-2.1. */
function extremeCases(): Case[] {
  const cases: Case[] = [];
  for (const mass_kg of MASSES_KG)
    for (const slope of SLOPES_DEG)
      for (const mu_s of MU_S)
        for (const magnitude_N of MAGNITUDES_N)
          for (const tractionDeg of ANGLES_DEG)
            for (const frictionDeg of ANGLES_DEG)
              cases.push({
                mass_kg,
                slope_rad: degToRad(slope),
                mu_s,
                forces: [
                  { key: 'traction', label: 'T', magnitude_N, angle_rad: degToRad(tractionDeg) },
                  { key: 'friction', label: 'F', magnitude_N, angle_rad: degToRad(frictionDeg) },
                ],
              });
  return cases;
}

function tipsOf(c: Case): Vec2[] {
  const readout = readFreeBody(c.mass_kg, c.forces, c.slope_rad, c.mu_s);
  return arrowTips_m(readout, c.slope_rad, true);
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return (
    a.x_px < b.x_px + b.width_px &&
    b.x_px < a.x_px + a.width_px &&
    a.y_px < b.y_px + b.height_px &&
    b.y_px < a.y_px + a.height_px
  );
}

describe('FreeBodyWidget layout · framing of the arrows (#347)', () => {
  test('keeps the scale of 0.045 m/N while the longest arrow fits', () => {
    const readout = readFreeBody(0.2, [], 0);
    const [weightTip] = arrowTips_m(readout, 0, false);
    expect(weightTip?.[1]).toBeCloseTo(-0.2 * 9.81 * M_PER_N, 6);
  });

  test('shrinks every arrow alike so the longest one is MAX_ARROW_M (3 kg on a plane)', () => {
    const readout = readFreeBody(3, [], 0);
    const [weight, normal] = arrowTips_m(readout, 0, false);
    expect(weight?.[1]).toBeCloseTo(-MAX_ARROW_M, 6);
    expect(normal?.[1]).toBeCloseTo(MAX_ARROW_M, 6);
  });

  test('every tip, head included, stays inside the view at the extremes of all ranges', () => {
    for (const c of extremeCases()) {
      for (const [x_m, y_m] of tipsOf(c)) {
        expect(Math.abs(x_m)).toBeLessThanOrEqual(MAX_ARROW_M + 1e-9);
        expect(Math.abs(y_m)).toBeLessThanOrEqual(MAX_ARROW_M + 1e-9);
        expect(Math.abs(x_m)).toBeLessThan(HALF_WIDTH_M);
        expect(Math.abs(y_m)).toBeLessThan(HALF_HEIGHT_M);
      }
    }
  });
});

describe('FreeBodyWidget layout · placement of the labels (#347)', () => {
  test.each([320, 480, 800])(
    'labels stay inside a %i px canvas and never overlap, at every extreme',
    (width_px) => {
      const height_px = width_px / VIEW_ASPECT;
      const pxPerM = width_px / VIEW_WIDTH_M;
      for (const c of extremeCases()) {
        const anchors = tipsOf(c).map(([x_m, y_m], index) => {
          const tip_px: [number, number] = [
            width_px / 2 + x_m * pxPerM,
            height_px / 2 - y_m * pxPerM,
          ];
          const delta_px: [number, number] = [x_m * pxPerM, -y_m * pxPerM];
          return { tip_px, delta_px, width_px: (LABELS[index] ?? '').length * CHAR_PX };
        });
        const boxes = placeLabels(anchors, { width_px, height_px });
        expect(boxes).toHaveLength(anchors.length);
        boxes.forEach((box, i) => {
          expect(box.height_px).toBe(LABEL_HEIGHT_PX);
          expect(box.x_px).toBeGreaterThanOrEqual(0);
          expect(box.y_px).toBeGreaterThanOrEqual(0);
          expect(box.x_px + box.width_px).toBeLessThanOrEqual(width_px);
          expect(box.y_px + box.height_px).toBeLessThanOrEqual(height_px);
          for (const other of boxes.slice(i + 1)) expect(overlaps(box, other)).toBe(false);
        });
      }
    },
  );

  test('a label that fits is drawn beside its tip, as before', () => {
    const [box] = placeLabels([{ tip_px: [300, 100], delta_px: [50, -20], width_px: 40 }], {
      width_px: 480,
      height_px: 343,
    });
    // Right of the tip by 8 px and above it by 4 px, like the label of `Vector`.
    expect(box).toEqual({ x_px: 308, y_px: 96 - LABEL_HEIGHT_PX, width_px: 40, height_px: 13 });
  });
});
