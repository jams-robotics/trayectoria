import { useContext, useEffect, useState } from 'react';

import { Scene2DContext } from '../Scene2D/context';
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
 * measures and re-reads the ref on every resize. Outside a `Scene2D` it stays null.
 */
export function useSceneTransformValue(host: Element | null): Transform | null {
  const scene = useContext(Scene2DContext);
  const [transform, setTransform] = useState<Transform | null>(null);
  useEffect(() => {
    if (scene === null) return;
    const read = (): void => {
      const current = scene.transformRef.current;
      setTransform((previous) => (sameMapping(previous, current) ? previous : current));
    };
    read();
    if (host === null || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(read);
    observer.observe(host);
    return () => {
      observer.disconnect();
    };
  }, [scene, host]);
  return transform;
}
