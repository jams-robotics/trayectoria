/**
 * Derivative of a state vector: `f(t_s, y)` returns `dy/dt` with the same length as `y`.
 * Must be pure, so the integrator can call it several times per step.
 */
export type Derivative = (t_s: number, y: readonly number[]) => readonly number[];

const addScaled = (
  y: readonly number[],
  k: readonly number[],
  factor: number,
): readonly number[] => y.map((value, i) => value + factor * (k[i] ?? 0));

/**
 * One explicit Euler step: `y + dt_s * f(t_s, y)`. First order, cheap and stable only for small
 * steps; prefer {@link rk4} unless the model needs the simpler behaviour.
 */
export function euler(
  f: Derivative,
  y: readonly number[],
  t_s: number,
  dt_s: number,
): readonly number[] {
  return addScaled(y, f(t_s, y), dt_s);
}

/** One classic fourth-order Runge-Kutta step over `dt_s`. */
export function rk4(
  f: Derivative,
  y: readonly number[],
  t_s: number,
  dt_s: number,
): readonly number[] {
  const half_s = dt_s / 2;
  const k1 = f(t_s, y);
  const k2 = f(t_s + half_s, addScaled(y, k1, half_s));
  const k3 = f(t_s + half_s, addScaled(y, k2, half_s));
  const k4 = f(t_s + dt_s, addScaled(y, k3, dt_s));

  return y.map(
    (value, i) =>
      value + (dt_s / 6) * ((k1[i] ?? 0) + 2 * (k2[i] ?? 0) + 2 * (k3[i] ?? 0) + (k4[i] ?? 0)),
  );
}
