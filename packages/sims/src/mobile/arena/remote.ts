import type { Steer } from './useManualDrive';

/** What a remote controller (the classroom's phones, #685) asks of the arena. */
export type RemoteEvent =
  | { readonly kind: 'drive'; readonly steer: Steer; readonly go: Steer }
  | { readonly kind: 'param'; readonly key: string; readonly value: number }
  /** A phone takes the wheel: the arena switches to a mode a phone can drive. */
  | { readonly kind: 'takeover' };

/** A source of remote events; the page that owns the transport implements it. */
export interface RemoteControl {
  subscribe(listener: (event: RemoteEvent) => void): () => void;
}
