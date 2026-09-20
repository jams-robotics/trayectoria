import type { DiffDriveState, WheelCommand } from '../mobile/diffDrive';
import type { LineReading } from '../sensors/lineArray';

/**
 * Line-following controller (`docs/ARCHITECTURE.md` §4.4). It turns one sensor reading and the
 * current state into wheel speeds. In v2 this is the interface the student code implements, so it
 * does not change. Implementations keep their own state and clear it in `reset()`.
 *
 * `params` is assignable, and every implementation reads it on each `update()`: a simulator can
 * replace it mid-run to apply new gains without rebuilding the controller, which would throw away
 * the internal state the run has built up (#161). The parameter types stay readonly, so a change
 * replaces the whole object rather than editing a field of it.
 */
export interface Controller<P> {
  params: P;
  reset(): void;
  update(reading: LineReading, state: DiffDriveState, dt_s: number): WheelCommand;
}
