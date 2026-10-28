import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { CHALLENGES, challengeOf } from './challenges';
import type { ChallengeId } from './challenges';
import { canRecord, download, startRecording } from './recorder';
import type { Overlay, Recording } from './recorder';
import { CAMERA_MODES } from './scene/cameraRig';
import { loadPassed, savePassed } from './stores/challengeProgress';
import type { ArenaLoop, ArenaSnapshot } from './useArenaLoop';
import type { ArenaSettingsApi } from './useArenaSettings';
import { KICK_RAD } from './race';

function typing(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    target instanceof HTMLElement &&
    (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)
  );
}

/** Space starts or pauses, R restarts, K kicks, 1–5 pick the camera. */
export function useArenaKeys(loop: ArenaLoop, api: ArenaSettingsApi): void {
  const latest = useRef({ loop, api });
  latest.current = { loop, api };
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (typing(event) || event.ctrlKey || event.metaKey || event.altKey) return;
      const { loop: current, api: settings } = latest.current;
      const camera = CAMERA_MODES[Number(event.key) - 1];
      if (event.key === ' ') current.setRunning(!current.running);
      else if (event.key === 'r' || event.key === 'R') current.reset();
      else if (event.key === 'k' || event.key === 'K') current.kick(KICK_RAD);
      else if (camera !== undefined) settings.update({ camera });
      else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

export interface ChallengeState {
  readonly passed: ReadonlySet<ChallengeId>;
  /** The challenge just passed, while its celebration is open. */
  readonly celebrating: ChallengeId | null;
  readonly dismiss: () => void;
  readonly next: (() => void) | null;
}

/** Checks the active challenge on every HUD snapshot and celebrates it once. */
export function useChallengeCheck(
  snapshot: ArenaSnapshot | null,
  api: ArenaSettingsApi,
): ChallengeState {
  const [passed, setPassed] = useState<ReadonlySet<ChallengeId>>(() => loadPassed());
  const [celebrating, setCelebrating] = useState<ChallengeId | null>(null);
  const { challenge: active, controller } = api.settings;
  const { startChallenge } = api;
  useEffect(() => {
    if (active === null || snapshot === null) return;
    if (!challengeOf(active).passed({ controller, you: snapshot.you, ghost: snapshot.ghost }))
      return;
    setCelebrating(active);
    setPassed((current) => {
      const next = new Set(current).add(active);
      savePassed(next);
      return next;
    });
    startChallenge(null);
  }, [snapshot, active, controller, startChallenge]);
  const following = CHALLENGES.find(
    (challenge) => challenge.id !== celebrating && !passed.has(challenge.id),
  );
  return {
    passed,
    celebrating,
    dismiss: () => setCelebrating(null),
    next:
      following === undefined
        ? null
        : () => {
            setCelebrating(null);
            startChallenge(following.id);
          },
  };
}

export interface RecorderState {
  readonly supported: boolean;
  readonly recording: boolean;
  readonly vertical: boolean;
  readonly setVertical: (vertical: boolean) => void;
  readonly toggle: () => void;
}

/** «Grabar»: records the arena canvas with the live overlay and downloads it on «Detener». */
export function useRecorder(
  canvas: RefObject<HTMLCanvasElement | null>,
  overlay: () => Overlay,
): RecorderState {
  const [supported] = useState(canRecord);
  const [vertical, setVertical] = useState(true);
  const recording = useRef<Recording | null>(null);
  const [active, setActive] = useState(false);
  const latestOverlay = useRef(overlay);
  latestOverlay.current = overlay;
  const toggle = useCallback(() => {
    const source = canvas.current;
    if (recording.current !== null) {
      void recording.current
        .stop()
        .then(({ blob, extension }) => download(blob, `trayectoria-pista-3d.${extension}`));
      recording.current = null;
      setActive(false);
      return;
    }
    if (source === null) return;
    const style = getComputedStyle(source);
    const colors = {
      fg: style.getPropertyValue('--color-fg').trim(),
      accent: style.getPropertyValue('--color-physical').trim(),
    };
    recording.current = startRecording(
      source,
      vertical ? 'vertical' : 'landscape',
      () => latestOverlay.current(),
      colors,
    );
    setActive(true);
  }, [canvas, vertical]);
  return { supported, recording: active, vertical, setVertical, toggle };
}
