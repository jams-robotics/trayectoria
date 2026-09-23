import { useCallback, useRef, useState } from 'react';
import type { JSX, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { useT } from '@trayectoria/i18n';
import { pointAt, trackLength_m } from '@trayectoria/sim-core';
import type { Track, Vec2 } from '@trayectoria/sim-core';
import { Circle, createTransform, pxToWorld } from '@trayectoria/widgets';

import { buildTrackIndex, projectOnTrack } from './lap';
import type { Pose } from './model';

/**
 * Arc length used to take the tangent at the projected point, in metres. It is the same step
 * `startPoseOf` uses in `model.ts`, and the one the golden value of #128 checks against
 * (`pointAt(s + 1e-3) − pointAt(s)`).
 */
export const TANGENT_STEP_M = 0.001;

/** Radius of the draggable marker, in world metres (docs/DESIGN.md §6: marcador del visor). */
export const HANDLE_RADIUS_M = 0.02;

/** Step of the keyboard field of `s_m`, in metres. */
export const S_STEP_M = 0.01;

/** Start pose plus the arc length it sits at, so the panel can show and edit `s_m`. */
export interface StartPose extends Pose {
  /** Arc length along the centerline, in metres. */
  readonly s_m: number;
}

/**
 * The pose of the track at arc length `s_m`: the point itself and the heading of the tangent
 * there, taken with `pointAt(s)` and `pointAt(s + TANGENT_STEP_M)` (valor dorado de #128).
 */
function poseAt(track: Track, s_m: number): StartPose {
  const here = pointAt(track, s_m);
  const ahead = pointAt(track, s_m + TANGENT_STEP_M);
  return {
    s_m,
    x_m: here[0],
    y_m: here[1],
    theta_rad: Math.atan2(ahead[1] - here[1], ahead[0] - here[0]),
  };
}

/**
 * Where the robot starts after a drop at `p_m`, or at the arc length `s_m` the keyboard field
 * gives. A point is projected onto the nearest sample of the centerline (`projectOnTrack`); an
 * arc length is wrapped into the loop so a field typed past the end never leaves the track.
 */
export function poseOnTrack(track: Track, p_m: Vec2 | null, s_m?: number): StartPose {
  if (s_m !== undefined) {
    const length_m = trackLength_m(track);
    const wrapped_m = length_m > 0 ? ((s_m % length_m) + length_m) % length_m : 0;
    return poseAt(track, wrapped_m);
  }
  return poseAt(track, projectOnTrack(buildTrackIndex(track), p_m ?? [0, 0]));
}

/** Pointer position in world metres over the canvas of `host`, or null before it is laid out. */
function worldOf(
  host: HTMLElement | null,
  event: ReactPointerEvent<HTMLElement>,
  view: { worldWidth_m: number; center_m: readonly [number, number] },
): Vec2 | null {
  const canvas = host?.querySelector('canvas') ?? null;
  if (canvas === null) return null;
  const box = canvas.getBoundingClientRect();
  if (box.width <= 0) return null;
  // The very `createTransform` the scene painted with, fed the same measurements: the pixels the
  // learner drags and the pixels the scene drew agree by construction (mismo criterio que #126).
  const transform = createTransform({
    widthPx: box.width,
    heightPx: box.height,
    worldWidth_m: view.worldWidth_m,
    center_m: view.center_m,
    dpr: 1,
  });
  return pxToWorld(transform, event.clientX - box.left, event.clientY - box.top);
}

/**
 * The marker of the start pose, drawn on the scene. It is a `Scene2D` child, so it has to be
 * rendered inside the scene; the overlay that drags it is `StartPoseHandle`, which wraps it.
 */
export function StartPoseMarker({ pose }: { pose: Pose }): JSX.Element {
  return (
    <Circle
      center_m={[pose.x_m, pose.y_m]}
      radius_m={HANDLE_RADIUS_M}
      color="sim-sensor-on"
      filled
    />
  );
}

export interface StartPoseHandleProps {
  readonly track: Track;
  /** Pose the handle currently sits at. */
  readonly pose: StartPose;
  /** Called with the projected pose when the drag is released or the field changes. */
  readonly onStartPoseChange: (pose: StartPose) => void;
  /** The view the enclosing `Scene2D` was given, so the drag maps pixels to the same metres. */
  readonly view: { readonly worldWidth_m: number; readonly center_m: readonly [number, number] };
  /**
   * The scene the handle is dragged over. It renders `StartPoseMarker` with `dragPose`, so the
   * marker follows the pointer while the drag is in progress.
   */
  readonly children: (dragPose: StartPose) => ReactNode;
}

/** The pointer handlers of a drag in progress, given the projector and the drag state. */
function dragHandlers(
  project: (event: ReactPointerEvent<HTMLElement>) => StartPose | null,
  dragging: StartPose | null,
  setDragging: (pose: StartPose | null) => void,
  onStartPoseChange: (pose: StartPose) => void,
): DragHandlers {
  return {
    onPointerDown: (event) => {
      const next = project(event);
      if (next === null) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(next);
    },
    onPointerMove: (event) => {
      if (dragging === null) return;
      const next = project(event);
      if (next !== null) setDragging(next);
    },
    onPointerUp: (event) => {
      if (dragging === null) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      const next = project(event) ?? dragging;
      setDragging(null);
      onStartPoseChange(next);
    },
  };
}

/** Pointer handlers of the overlay div. */
interface DragHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/** The drag of the handle: where it currently is and the handlers that move it. */
function useDrag(
  track: Track,
  view: StartPoseHandleProps['view'],
  onStartPoseChange: (pose: StartPose) => void,
): {
  hostRef: RefObject<HTMLDivElement | null>;
  dragging: StartPose | null;
  handlers: DragHandlers;
} {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<StartPose | null>(null);
  const project = useCallback(
    (event: ReactPointerEvent<HTMLElement>): StartPose | null => {
      const p_m = worldOf(hostRef.current, event, view);
      return p_m === null ? null : poseOnTrack(track, p_m);
    },
    [track, view],
  );
  return {
    hostRef,
    dragging,
    handlers: dragHandlers(project, dragging, setDragging, onStartPoseChange),
  };
}

/** The drag overlay over the scene and the keyboard route into the same pose. */
export function StartPoseHandle({
  track,
  pose,
  onStartPoseChange,
  view,
  children,
}: StartPoseHandleProps): JSX.Element {
  const t = useT();
  const { hostRef, dragging, handlers } = useDrag(track, view, onStartPoseChange);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={hostRef}
        data-testid="start-pose-handle"
        role="group"
        aria-label={t('sims.mobilePage.startPose')}
        // Without it the browser pans the page instead of letting the drag reach the canvas.
        style={{ touchAction: 'none' }}
        {...handlers}
      >
        {children(dragging ?? pose)}
      </div>
      <SField
        pose={pose}
        track={track}
        onStartPoseChange={onStartPoseChange}
        label={t('sims.mobilePage.startS')}
      />
    </div>
  );
}

/** The keyboard route into the same pose: the arc length `s_m` as a number field. */
function SField({
  pose,
  track,
  onStartPoseChange,
  label,
}: {
  pose: StartPose;
  track: Track;
  onStartPoseChange: (pose: StartPose) => void;
  label: string;
}): JSX.Element {
  return (
    <label className="text-fg-muted flex items-center gap-2 text-sm">
      {label}
      <input
        type="number"
        data-testid="start-pose-s"
        className="border-border bg-bg text-fg h-9 w-12 rounded-sm border px-2 font-mono text-sm tabular-nums"
        step={S_STEP_M}
        value={pose.s_m.toFixed(2)}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value)) onStartPoseChange(poseOnTrack(track, null, value));
        }}
      />
    </label>
  );
}
