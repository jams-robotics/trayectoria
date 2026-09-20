import { useEffect, useMemo } from 'react';
import type { JSX } from 'react';
import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three';

import { pointColors, readWorkspacePalette } from './colors';

// F5-03 (#136, decisiones 1 y 5): la nube va en un `Points` de three colgado del `Canvas` de
// `Scene3D` con `<primitive>`, como el robot de `UrdfModel`. Los colores los calcula `colors.ts`
// y viajan en el atributo `color` de la geometría: three no interpola nada, solo los pinta
// (criterio del ticket: nada de shaders). Recalcular sustituye la nube y libera la anterior.

/** Tamaño del punto en píxeles; `sizeAttenuation: false` lo mantiene fijo con el zoom. */
const POINT_SIZE_PX = 2;

export interface WorkspacePointsProps {
  /** La nube aplanada `[x0, y0, z0, …]`, en metros, de `sampleWorkspaceInBatches`. */
  points: Float32Array;
  /** Si la nube se dibuja; el toggle del panel la apaga sin recalcularla. */
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

/** El objeto `Points`, reconstruido solo cuando cambia la nube; libera el anterior al morir. */
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
      // `material` de three puede ser uno o varios; el de la nube es siempre uno.
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    },
    [object],
  );

  return object;
}

/**
 * Nube de puntos del espacio de trabajo del brazo. Cada punto es una posición alcanzable
 * calculada por sim-core; el color viene de su distancia a la base (docs/DESIGN.md §2.2).
 */
export function WorkspacePoints({ points, visible }: WorkspacePointsProps): JSX.Element {
  const object = useWorkspaceObject(points);
  // La visibilidad se pone en el propio objeto de three, no como prop de `<primitive>`: R3F
  // asigna cada prop al objeto, así que el elemento no lleva más prop que el objeto mismo
  // (mismo criterio que `UrdfModel`, F5-01a).
  object.visible = visible;
  return <primitive object={object} />;
}
