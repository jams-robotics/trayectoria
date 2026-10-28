// Separate entry point `@trayectoria/sims/arena` (docs/ARCHITECTURE.md §8: `three` only on 3D
// pages). The package barrel `src/index.ts` must never reexport anything from here.
export { Arena } from './Arena';
export type { ArenaProps } from './Arena';
