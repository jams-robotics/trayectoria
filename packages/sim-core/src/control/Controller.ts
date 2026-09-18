import type { DiffDriveState, WheelCommand } from '../mobile/diffDrive';
import type { LineReading } from '../sensors/lineArray';

/**
 * Line-following controller (`docs/ARCHITECTURE.md` §4.4). It turns one sensor reading and the
 * current state into wheel speeds. In v2 this is the interface the student code implements, so it
 * does not change. Implementations keep their own state and clear it in `reset()`.
 */
export interface Controller<P> {
  readonly params: P;
  reset(): void;
  update(reading: LineReading, state: DiffDriveState, dt_s: number): WheelCommand;
}
