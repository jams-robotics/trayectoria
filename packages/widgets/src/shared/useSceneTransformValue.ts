import { useCallback, useContext, useEffect, useState } from 'react';

import { Scene2DContext, useSceneDraw } from '../Scene2D/context';
import type { Transform } from '../Scene2D/transform';

/** True when the two mappings place the same world point at the same pixel. */
function sameMapping(a: Transform | null, b: Transform | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.pxPerM === b.pxPerM &&
    a.widthPx === b.widthPx &&
    a.heightPx === b.heightPx &&
    a.center_m[0] === b.center_m[0] &&
    a.center_m[1] === b.center_m[1]
  );
}

/**
 * The mapping of the enclosing `Scene2D` as a value that re-renders the overlay when it changes
 * (#86, decision 3). `Scene2D` keeps it in a ref and does not re-render its children when the
 * container is resized, so an overlay positioned in pixels watches the same element the scene
 * measures and re-reads the ref on every resize. `worldWidth_m` or `center_m` can also change the
 * mapping with no resize at all (the view zooms to keep framing the ICR as a handle is dragged),
 * so the overlay also re-reads it on every scene repaint, which `Scene2D` requests on exactly
 * those changes (#292).
 */
export function useSceneTransformValue(host: Element | null): Transform | null {
  const scene = useContext(Scene2DContext);
  const [transform, setTransform] = useState<Transform | null>(null);
  const adopt = useCallback((current: Transform | null): void => {
    setTransform((previous) => (sameMapping(previous, current) ? previous : current));
  }, []);
  const read = useCallback((): void => {
    if (scene === null) return;
    adopt(scene.transformRef.current);
  }, [scene, adopt]);
  // Every repaint of the scene carries its current mapping, which is how the overlay learns of a
  // change with no resize at all, such as the view zooming to keep framing a dragged handle.
  useSceneDraw(useCallback((_ctx, current) => adopt(current), [adopt]));
  useEffect(() => {
    if (scene === null) return;
    read();
    if (host === null || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(read);
    observer.observe(host);
    return () => {
      observer.disconnect();
    };
  }, [scene, host, read]);
  return transform;
}
