// Separate entry point `@trayectoria/widgets/scene3d` (docs/ARCHITECTURE.md §8: `three` only on
// 3D pages). The package barrel `src/index.ts` must never reexport anything from here.
export { Scene3D, useSceneColors } from './Scene3D';
export type { Scene3DProps } from './Scene3D';
export { Frame, AXIS_TOKENS } from './Frame';
export type { FrameProps } from './Frame';
