// Tipos compartidos por los módulos del visor de brazo, en un archivo propio para que los
// componentes no dependan del módulo que los produce (docs/STANDARDS.md §4: un módulo por
// concepto).
export type { ArmColors } from './armColors';
export type { ActuatedJoint, ArmSim, EffectorReadout } from './useArmSim';
