import { useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControlsChangeEvent } from '@react-three/drei';

import { tokenColor } from '../shared/theme';
import { CAMERA_FOV_DEG, initialView } from './framing';
import type { CameraView, Vec3_m } from './framing';

/** Visible aspect of the viewer as a CSS ratio, width over height (16/9, like `Scene2D`). */
const ASPECT = '16 / 9';
/** Device pixel ratio bounds of the canvas (docs/ARCHITECTURE.md §8: hi-DPI ≤ 2). */
const DPR: readonly [number, number] = [1, 2];
/** Side of the ground grid, in metres, and the number of divisions along it. */
const GRID_SIZE_M = 2;
const GRID_DIVISIONS = 20;
/** Intensity of each light of the scene. */
const AMBIENT_INTENSITY = 0.6;
const DIRECTIONAL_INTENSITY = 1.1;
/** Position of the directional light, in metres. */
const LIGHT_POSITION_M: readonly [number, number, number] = [1.5, -1.5, 2.5];
/** Below this distance, in metres, two camera offsets count as the same one. */
const SAME_POSITION_EPS_M = 1e-6;

export interface Scene3DProps {
  /** World axis that points up. Defaults to `z` (docs/WIDGETS.md, Scene3D). */
  up?: 'z' | 'y';
  /** Whether the ground grid is drawn. Defaults to true. */
  showGrid?: boolean;
  /** Textual description of the scene, already translated by the widget that uses it. */
  description: string;
  /**
   * Points of what the scene shows at rest, in metres (#556): the orbit turns around the centre
   * of their box and the initial camera frames it (`framing.ts`). Without them, the default view
   * of the grid around the origin.
   */
  framePoints_m?: readonly Vec3_m[] | undefined;
  /** Camera offset from the target to start from, in metres: the zoom the user left before. */
  cameraOffset_m?: Vec3_m | undefined;
  /** Reports the camera offset from the target each time the user orbits or zooms. */
  onCameraChange?: ((offset_m: Vec3_m) => void) | undefined;
  children: ReactNode;
}

/** The up vector of the camera for each supported `up` axis. */
const UP_VECTORS: Readonly<Record<'z' | 'y', readonly [number, number, number]>> = {
  z: [0, 0, 1],
  y: [0, 1, 0],
};

/**
 * `gridHelper` lies on the XZ plane, so with `up: 'z'` it is rotated a quarter turn about X to
 * land on the XY ground plane. With `up: 'y'` it already is the ground plane.
 */
const GRID_ROTATION_RAD: Readonly<Record<'z' | 'y', readonly [number, number, number]>> = {
  z: [Math.PI / 2, 0, 0],
  y: [0, 0, 0],
};

/** Whether two camera offsets are the same one, within floating-point noise. */
function samePosition(a: Vec3_m, b: Vec3_m): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < SAME_POSITION_EPS_M;
}

/**
 * Background and grid colours read from the CSS tokens, re-read whenever `data-theme` changes
 * on `<html>` (docs/DESIGN.md §7: every colour comes from tokens, no hex in components).
 */
export function useSceneColors(): { background: string; grid: string; axis: string } {
  const read = (): { background: string; grid: string; axis: string } => {
    const element = typeof document === 'undefined' ? null : document.documentElement;
    return {
      background: tokenColor(element, 'color-bg-raised'),
      grid: tokenColor(element, 'sim-grid'),
      axis: tokenColor(element, 'sim-axis'),
    };
  };
  const [colors, setColors] = useState(read);
  useEffect(() => {
    if (typeof MutationObserver !== 'function' || typeof document === 'undefined') return;
    const observer = new MutationObserver(() => {
      setColors(read());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      observer.disconnect();
    };
  }, []);
  return colors;
}

/**
 * The orbit controls around the target of the view, reporting the camera offset when the user
 * moves it. The controls fire `change` once on their first update even though the camera has not
 * moved, so an offset equal to the initial one is not reported: only what the user orbits or
 * zooms counts.
 */
function Orbit({
  view,
  onCameraChange,
}: {
  view: CameraView;
  onCameraChange: ((offset_m: Vec3_m) => void) | undefined;
}): JSX.Element {
  const [x_m, y_m, z_m] = view.target_m;
  const report = (event?: OrbitControlsChangeEvent): void => {
    const camera = event?.target.object;
    if (camera === undefined || onCameraChange === undefined) return;
    const offset_m: Vec3_m = [camera.position.x - x_m, camera.position.y - y_m, camera.position.z - z_m];
    if (!samePosition(offset_m, view.offset_m)) onCameraChange(offset_m);
  };
  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      target={[x_m, y_m, z_m]}
      {...(onCameraChange === undefined ? {} : { onChange: report })}
    />
  );
}

/** Lights and ground grid: everything the viewer draws besides its children and the orbit. */
function SceneRig({
  up,
  showGrid,
  colors,
}: {
  up: 'z' | 'y';
  showGrid: boolean;
  colors: { grid: string; axis: string };
}): JSX.Element {
  return (
    <>
      <ambientLight intensity={AMBIENT_INTENSITY} />
      <directionalLight
        intensity={DIRECTIONAL_INTENSITY}
        position={[LIGHT_POSITION_M[0], LIGHT_POSITION_M[1], LIGHT_POSITION_M[2]]}
      />
      {showGrid ? (
        <gridHelper
          args={[GRID_SIZE_M, GRID_DIVISIONS, colors.axis, colors.grid]}
          rotation={[
            GRID_ROTATION_RAD[up][0],
            GRID_ROTATION_RAD[up][1],
            GRID_ROTATION_RAD[up][2],
          ]}
        />
      ) : null}
    </>
  );
}

/**
 * 3D viewer on React Three Fiber (docs/WIDGETS.md, Scene3D; docs/ARCHITECTURE.md §3.4: the only
 * wrapper of `three`, `@react-three/fiber` and `@react-three/drei`). It owns the canvas, the
 * lights, the ground grid and the orbit controls; the scene content comes in as declarative
 * children (`Frame`, meshes).
 *
 * `three` must never reach the bundle of a 2D topic page (docs/ARCHITECTURE.md §8), so this
 * module lives behind the `@trayectoria/widgets/scene3d` entry point and is never reexported by
 * the package barrel.
 */
export function Scene3D({
  up = 'z',
  showGrid = true,
  description,
  children,
  ...camera
}: Scene3DProps): JSX.Element {
  const colors = useSceneColors();
  const upVector = UP_VECTORS[up];
  // The camera reads its position only when the canvas mounts: the first value is the one that counts.
  const [view] = useState(() => initialView(camera.cameraOffset_m, camera.framePoints_m, upVector));
  const position_m = view.target_m.map((value, axis) => value + (view.offset_m[axis] ?? 0));
  return (
    <div
      className="bg-bg-raised border-border w-full overflow-hidden rounded-lg border"
      style={{ aspectRatio: ASPECT }}
      data-testid="scene3d"
    >
      <Canvas
        role="img"
        aria-label={description}
        dpr={[DPR[0], DPR[1]]}
        // The drawing buffer survives the frame it was drawn in, so a screenshot of the page
        // captures the scene instead of an already cleared buffer (the visual regression shot of
        // `e2e/visual/Scene3D.png` came out blank without it).
        gl={{ preserveDrawingBuffer: true }}
        camera={{
          position: [position_m[0] ?? 0, position_m[1] ?? 0, position_m[2] ?? 0],
          fov: CAMERA_FOV_DEG,
          up: [upVector[0], upVector[1], upVector[2]],
        }}
        style={{ background: colors.background }}
        data-up={up}
        data-camera-position={position_m.join(',')}
        data-camera-target={view.target_m.join(',')}
      >
        <SceneRig up={up} showGrid={showGrid} colors={colors} />
        <Orbit view={view} onCameraChange={camera.onCameraChange} />
        {children}
      </Canvas>
    </div>
  );
}
