// How the learner's model sits on the chassis. The automatic fit is applied first; these are
// the learner's corrections on top.

export type Quarters = readonly [number, number, number];

export interface ModelAdjust {
  /** Multiplier over the automatic fit. */
  readonly scale: number;
  /** Quarter turns (90° each) around x, y and z. */
  readonly quarters: Quarters;
  /** Lift over the chassis plate, in millimetres. */
  readonly lift_mm: number;
  /** Keep drawing the spec's wheels over the model. */
  readonly wheels: boolean;
}

export const DEFAULT_ADJUST: ModelAdjust = {
  scale: 1,
  quarters: [0, 0, 0],
  lift_mm: 0,
  wheels: true,
};

/** `quarters` after one more quarter turn around axis `axis` (0 = x, 1 = y, 2 = z). */
export function turned(quarters: Quarters, axis: 0 | 1 | 2): Quarters {
  const [x, y, z] = quarters;
  return [
    (x + (axis === 0 ? 1 : 0)) % 4,
    (y + (axis === 1 ? 1 : 0)) % 4,
    (z + (axis === 2 ? 1 : 0)) % 4,
  ];
}

export const SCALE_RANGE = { min: 0.25, max: 3, step: 0.05 } as const;
export const LIFT_RANGE_MM = { min: -20, max: 60, step: 1 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function quarter(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? ((value % 4) + 4) % 4 : 0;
}

/** An adjust from untrusted data (what IndexedDB returned); anything odd falls to the default. */
export function parseAdjust(data: unknown): ModelAdjust {
  if (typeof data !== 'object' || data === null) return DEFAULT_ADJUST;
  const { scale, quarters, lift_mm, wheels }: Record<string, unknown> = Object.fromEntries(
    Object.entries(data),
  );
  const turns: unknown[] = Array.isArray(quarters) ? quarters : [];
  return {
    scale:
      typeof scale === 'number' && Number.isFinite(scale)
        ? clamp(scale, SCALE_RANGE.min, SCALE_RANGE.max)
        : 1,
    quarters: [quarter(turns[0]), quarter(turns[1]), quarter(turns[2])],
    lift_mm:
      typeof lift_mm === 'number' && Number.isFinite(lift_mm)
        ? clamp(lift_mm, LIFT_RANGE_MM.min, LIFT_RANGE_MM.max)
        : 0,
    wheels: typeof wheels === 'boolean' ? wheels : true,
  };
}
