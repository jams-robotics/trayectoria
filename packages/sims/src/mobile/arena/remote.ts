import type { FreeProgress } from './freeRace';
import type { Steer } from './useManualDrive';

/** The views a phone can put on the projected screen: the ones where right is right. */
export type RemoteCamera = 'chase' | 'onboard' | 'top';

/** What a remote controller (the classroom's phones, #685) asks of the arena. */
export type RemoteEvent =
  | { readonly kind: 'drive'; readonly steer: Steer; readonly go: Steer }
  | { readonly kind: 'param'; readonly key: string; readonly value: number }
  /** A phone takes the wheel: a fresh run, in a mode a phone can drive, seen from behind. */
  | { readonly kind: 'takeover' }
  /** Starts the run again: stars back, stopwatch at zero. */
  | { readonly kind: 'restart' }
  | { readonly kind: 'camera'; readonly mode: RemoteCamera };

/** A source of remote events; the page that owns the transport implements it. */
export interface RemoteControl {
  subscribe(listener: (event: RemoteEvent) => void): () => void;
  /** Hears how the free run goes (`null` on a track), at most about once a second. */
  report?: (progress: FreeProgress | null) => void;
}
