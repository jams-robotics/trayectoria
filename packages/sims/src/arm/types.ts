// Types shared by the arm viewer modules, in a file of their own so that the
// components do not depend on the module that produces them (docs/STANDARDS.md §4: one module per
// concept).
export type { ArmColors } from './armColors';
export type { ActuatedJoint, ArmSim, EffectorReadout } from './useArmSim';
