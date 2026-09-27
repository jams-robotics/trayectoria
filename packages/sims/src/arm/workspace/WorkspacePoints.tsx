import { useEffect, useMemo } from 'react';
import type { JSX } from 'react';
import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three';

import { pointColors, readWorkspacePalette } from './colors';

// F5-03 (#136, decisions 1 and 5): the cloud goes in a three `Points` hung from the `Canvas` of
// `Scene3D` with `<primitive>`, like the robot of `UrdfModel`. The colours are computed by `colors.ts`
// and travel in the geometry's `color` attribute: three interpolates nothing, it only paints them
// (ticket criterion: no shaders). Recomputing replaces the cloud and disposes the previous one.

/** Point size in pixels; `sizeAttenuation: false` keeps it fixed with the zoom. */
const POINT_SIZE_PX = 2;

export interface WorkspacePointsProps {
  /** The flattened cloud `[x0, y0, z0, …]`, in metres, from `sampleWorkspaceInBatches`. */
  points: Float32Array;
  /** Whether the cloud is drawn; the panel toggle turns it off without recomputing it. */
  visible: boolean;
}

/**
 * Builds the `Points` object for a cloud: positions as they come from sim-core and one colour
 * per point from `colors.ts`, resolved against `element`'s tokens.
 */
export function buildWorkspacePoints(points: Float32Array, element: Element | null): Points {
  const palette = readWorkspacePalette(element);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(points, 3));
  geometry.setAttribute('color', new BufferAttribute(pointColors(points, palette), 3));
  const material = new PointsMaterial({
    size: POINT_SIZE_PX,
    sizeAttenuation: false,
    vertexColors: true,
  });
  return new Points(geometry, material);
}

/** The `Points` object, rebuilt only when the cloud changes; disposes the previous one when it dies. */
function useWorkspaceObject(points: Float32Array): Points {
  const object = useMemo(
    () =>
      buildWorkspacePoints(
        points,
        typeof document === 'undefined' ? null : document.documentElement,
      ),
    [points],
  );

  useEffect(
    () => () => {
      object.geometry.dispose();
      // A three `material` can be one or several; the cloud's is always one.
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    },
    [object],
  );

  return object;
}

/**
 * Point cloud of the arm workspace. Each point is a reachable position
 * computed by sim-core; the colour comes from its distance to the base (docs/DESIGN.md §2.2).
 */
export function WorkspacePoints({ points, visible }: WorkspacePointsProps): JSX.Element {
  const object = useWorkspaceObject(points);
  // Visibility is set on the three object itself, not as a prop of `<primitive>`: R3F
  // assigns every prop to the object, so the element carries no prop other than the object itself
  // (same criterion as `UrdfModel`, F5-01a).
  object.visible = visible;
  return <primitive object={object} />;
}
