import { createContext, useContext, useEffect, useId } from 'react';

import type { Transform } from './transform';

/**
 * What a primitive paints. It receives the 2D context (already scaled to CSS pixels by the
 * device pixel ratio) and the current mapping; it must not resize the canvas nor clear it.
 */
export type DrawFn = (ctx: CanvasRenderingContext2D, transform: Transform) => void;

export interface Scene2DContextValue {
  /**
   * Registers a primitive's painter and returns the unregister function. Primitives paint in
   * registration order, which is the order of the children in the tree (#84, decision 2).
   */
  register(id: string, draw: DrawFn): () => void;
  /** Schedules a single redraw of the canvas on the next frame; repeated calls coalesce. */
  requestDraw(): void;
}

/** Null outside a `Scene2D`, so a primitive rendered on its own can say so instead of crashing. */
export const Scene2DContext = createContext<Scene2DContextValue | null>(null);

/**
 * Registers `draw` with the enclosing scene for the lifetime of the component and schedules a
 * redraw whenever `draw` changes (that is, whenever the primitive's props change). Outside a
 * `Scene2D` it does nothing: the primitive simply paints nowhere.
 */
export function useSceneDraw(draw: DrawFn): Scene2DContextValue | null {
  const scene = useContext(Scene2DContext);
  const id = useId();
  useEffect(() => {
    if (scene === null) return;
    const unregister = scene.register(id, draw);
    scene.requestDraw();
    return () => {
      unregister();
      scene.requestDraw();
    };
  }, [scene, id, draw]);
  return scene;
}
