/**
 * Realtime side of a class session (#685): one private broadcast topic per participant,
 * `aula:{session_id}:{user_id}`. Who sent a message is the topic, which the policies of migration
 * 0014 tie to the JWT; the payload never carries an identity. Messages are validated here before
 * anything acts on them.
 */
import type { DbClient } from '@trayectoria/db';
import type { RemoteCamera } from '@trayectoria/sims/arena';

export type Axis = -1 | 0 | 1;

export type ClassMessage =
  | { readonly kind: 'drive'; readonly steer: Axis; readonly go: Axis }
  | { readonly kind: 'param'; readonly key: string; readonly value: number }
  | { readonly kind: 'turn'; readonly active: boolean }
  /** Phone → PC: start the run again. */
  | { readonly kind: 'restart' }
  /** Phone → PC: the view of the projected screen. */
  | { readonly kind: 'camera'; readonly mode: RemoteCamera }
  /** PC → phone: how the free run goes. */
  | {
      readonly kind: 'progress';
      readonly collected: number;
      readonly total: number;
      readonly time_s: number;
      readonly done: boolean;
    };

const CAMERAS: readonly RemoteCamera[] = ['chase', 'onboard', 'top'];

const EVENT = 'msg';

/** The phone sends at most this often while a button is held (the server quota counts messages). */
export const SEND_INTERVAL_MS = 1000 / 15;

export function topicOf(sessionId: string, userId: string): string {
  return `aula:${sessionId}:${userId}`;
}

function axisOf(value: unknown): Axis | null {
  return value === -1 || value === 0 || value === 1 ? value : null;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

/** A progress message, with counts in range and a finite time, or `null`. */
function progressOf(payload: object): ClassMessage | null {
  const field = (name: string): unknown => Reflect.get(payload, name);
  const [collected, total, time_s, done] = ['collected', 'total', 'time_s', 'done'].map(field);
  if (!isCount(collected) || !isCount(total) || typeof done !== 'boolean') return null;
  if (typeof time_s !== 'number' || !Number.isFinite(time_s) || time_s < 0) return null;
  return { kind: 'progress', collected, total, time_s, done };
}

/** A message of the wire as one of the known shapes, or `null` for anything else. */
export function parseMessage(payload: unknown): ClassMessage | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const field = (name: string): unknown => Reflect.get(payload, name);
  const [kind, steer, go, key, value, active] = [
    'kind',
    'steer',
    'go',
    'key',
    'value',
    'active',
  ].map(field);
  const steerAxis = axisOf(steer);
  const goAxis = axisOf(go);
  if (kind === 'drive' && steerAxis !== null && goAxis !== null)
    return { kind, steer: steerAxis, go: goAxis };
  if (kind === 'param' && typeof key === 'string' && typeof value === 'number')
    return Number.isFinite(value) ? { kind, key, value } : null;
  if (kind === 'turn' && typeof active === 'boolean') return { kind, active };
  if (kind === 'restart') return { kind };
  const mode = CAMERAS.find((camera) => camera === field('mode'));
  if (kind === 'camera') return mode === undefined ? null : { kind, mode };
  if (kind === 'progress') return progressOf(payload);
  return null;
}

export interface TopicHandle {
  send: (message: ClassMessage) => void;
  close: () => void;
}

/** Joins a private topic; `onMessage` gets only the messages that parse. */
export function openTopic(
  db: DbClient,
  topic: string,
  onMessage: (message: ClassMessage) => void,
): TopicHandle {
  const channel = db.channel(topic, { config: { private: true } });
  channel.on('broadcast', { event: EVENT }, (frame) => {
    const message = parseMessage(frame.payload);
    if (message !== null) onMessage(message);
  });
  channel.subscribe();
  return {
    send: (message) => void channel.send({ type: 'broadcast', event: EVENT, payload: message }),
    close: () => void db.removeChannel(channel),
  };
}

export interface DriveSender {
  /** The buttons held now; sends at once when it changes and repeats while held. */
  set: (steer: Axis, go: Axis) => void;
  stop: () => void;
}

/**
 * Throttles a phone's drive commands to ~15 Hz. A change goes out at once (the stop most of all);
 * while something is held it repeats every interval, which is also what lets the PC tell a held
 * button from a lost connection.
 */
export function createDriveSender(send: (message: ClassMessage) => void): DriveSender {
  let steer: Axis = 0;
  let go: Axis = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const emit = (): void => send({ kind: 'drive', steer, go });
  const halt = (): void => {
    clearInterval(timer);
    timer = undefined;
  };
  return {
    set(nextSteer, nextGo) {
      if (nextSteer === steer && nextGo === go) return;
      steer = nextSteer;
      go = nextGo;
      emit();
      if (steer === 0 && go === 0) halt();
      else timer ??= setInterval(emit, SEND_INTERVAL_MS);
    },
    stop: halt,
  };
}

/** Throttles the slider changes of «Ajustar»: the first goes at once, the rest keep the last value. */
export function createParamSender(
  send: (message: ClassMessage) => void,
): (key: string, value: number) => void {
  const last = new Map<string, number>();
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  return (key, value) => {
    clearTimeout(pending.get(key));
    const wait = SEND_INTERVAL_MS - (Date.now() - (last.get(key) ?? 0));
    const go = (): void => {
      last.set(key, Date.now());
      send({ kind: 'param', key, value });
    };
    if (wait <= 0) go();
    else pending.set(key, setTimeout(go, wait));
  };
}
