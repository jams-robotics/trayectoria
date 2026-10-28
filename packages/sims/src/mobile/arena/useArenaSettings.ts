import { useCallback, useMemo, useState } from 'react';
import { REFERENCE_PID_PARAMS } from '@trayectoria/sim-core';

import { CONTROLLERS } from '../lineFollower/controllers';
import type { ControllerId, ControllerParams } from '../lineFollower/controllers';
import type { ArenaTrackId } from './arenaTracks';
import { challengeOf } from './challenges';
import type { ChallengeId } from './challenges';
import type { CameraMode } from './scene/cameraRig';

/** Everything the learner chooses in the arena. */
export interface ArenaSettings {
  readonly track: ArenaTrackId;
  /** The free arena (cones and goals, no line) instead of a track. */
  readonly free: boolean;
  readonly controller: ControllerId;
  /** Gains of every controller, so switching tabs keeps what was tuned on each one. */
  readonly params: Readonly<Record<ControllerId, ControllerParams>>;
  readonly ghost: boolean;
  /** Controller of the rival (never manual) and its gains, apart from the learner's. */
  readonly rival: ControllerId;
  readonly rivalParams: Readonly<Record<ControllerId, ControllerParams>>;
  readonly noise: boolean;
  readonly camera: CameraMode;
  /** Playback multiplier of the simulated time. */
  readonly speed: number;
  readonly challenge: ChallengeId | null;
}

export const PLAYBACK_SPEEDS: readonly number[] = [0.25, 0.5, 1, 2];
/** Standard deviation of the sensor noise when «Ruido» is on. */
export const NOISE_SIGMA = 0.06;

/** The arena opens on the long circuit, PID a bit faster than the reference, racing the ghost. */
export const INITIAL_SETTINGS: ArenaSettings = {
  track: 'circuit',
  free: false,
  controller: 'pid',
  params: {
    manual: CONTROLLERS.manual.defaults,
    onoff: CONTROLLERS.onoff.defaults,
    p: CONTROLLERS.p.defaults,
    pid: { ...CONTROLLERS.pid.defaults, omegaBase_radps: 13 },
  },
  ghost: true,
  rival: 'pid',
  rivalParams: {
    manual: CONTROLLERS.manual.defaults,
    onoff: CONTROLLERS.onoff.defaults,
    p: CONTROLLERS.p.defaults,
    pid: { ...REFERENCE_PID_PARAMS },
  },
  noise: false,
  camera: 'chase',
  speed: 1,
  challenge: null,
};

/** True while the rival is the reference PID, the one the challenges are calibrated against. */
export function isReferenceRival(settings: ArenaSettings): boolean {
  const pid = settings.rivalParams.pid;
  return (
    settings.rival === 'pid' &&
    Object.entries(REFERENCE_PID_PARAMS).every(([key, value]) => pid[key] === value)
  );
}

type SettingsPatch = Partial<Omit<ArenaSettings, 'params' | 'rivalParams'>>;

export interface ArenaSettingsApi {
  readonly settings: ArenaSettings;
  readonly update: (patch: SettingsPatch) => void;
  readonly setParam: (key: string, value: number) => void;
  readonly setRivalParam: (key: string, value: number) => void;
  readonly startChallenge: (id: ChallengeId | null) => void;
  /** Opens the free arena: manual driving only, no rival and no challenge. */
  readonly startFree: () => void;
  /** Picks a track; coming from the free arena it brings back the PID and the ghost. */
  readonly pickTrack: (id: ArenaTrackId) => void;
}

type GainsById = ArenaSettings['params'];

/** The gains of every controller with one gain of `id` changed. */
function withGain(all: GainsById, id: ControllerId, key: string, value: number): GainsById {
  return { ...all, [id]: { ...all[id], [key]: value } };
}

/** The free arena: manual driving only, no rival and no challenge. */
function freeOf(current: ArenaSettings): ArenaSettings {
  return { ...current, free: true, controller: 'manual', ghost: false, challenge: null };
}

/** `id` as the track; coming from the free arena it brings back the PID and the ghost. */
function withTrack(current: ArenaSettings, id: ArenaTrackId): ArenaSettings {
  if (!current.free) return { ...current, track: id };
  return { ...current, free: false, track: id, controller: 'pid', ghost: true };
}

export function useArenaSettings(initial: ArenaSettings = INITIAL_SETTINGS): ArenaSettingsApi {
  const [settings, setSettings] = useState(initial);
  const update = useCallback((patch: SettingsPatch) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);
  const setParam = useCallback((key: string, value: number) => {
    setSettings((current) => ({
      ...current,
      params: withGain(current.params, current.controller, key, value),
    }));
  }, []);
  const setRivalParam = useCallback((key: string, value: number) => {
    setSettings((current) => ({
      ...current,
      rivalParams: withGain(current.rivalParams, current.rival, key, value),
    }));
  }, []);
  const startChallenge = useCallback((id: ChallengeId | null) => {
    setSettings((current) => {
      if (id === null) return { ...current, challenge: null };
      const challenge = challengeOf(id);
      return {
        ...current,
        challenge: id,
        track: challenge.track,
        ghost: challenge.ghost,
        controller: challenge.controller ?? current.controller,
      };
    });
  }, []);
  const startFree = useCallback(() => setSettings(freeOf), []);
  const pickTrack = useCallback((id: ArenaTrackId) => {
    setSettings((current) => withTrack(current, id));
  }, []);
  return useMemo(
    () => ({ settings, update, setParam, setRivalParam, startChallenge, startFree, pickTrack }),
    [settings, update, setParam, setRivalParam, startChallenge, startFree, pickTrack],
  );
}
