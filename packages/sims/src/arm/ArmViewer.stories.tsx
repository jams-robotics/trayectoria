import type { JSX } from 'react';

import { ArmViewer } from './ArmViewer';

// `order` fija la secuencia de stories que renderiza el playground /dev/sims, independiente del
// orden de iteración del módulo (docs/audits F2-01a: hydration mismatch).
export default { title: 'ArmViewer', order: ['Planar', 'So101'] };

/** Configuración inicial del brazo plano, en radianes: hombro a 45°, codo a −45°. */
const PLANAR_INITIAL_Q_RAD = [Math.PI / 4, -Math.PI / 4];

/**
 * Brazo plano de 2 GDL del catálogo con los marcos visibles (#133, decisión 9). Es el caso
 * capturado en `ArmViewer.png`.
 */
export function Planar(): JSX.Element {
  return <ArmViewer catalogId="planar2dof" initialQ={PLANAR_INITIAL_Q_RAD} show={['frames']} />;
}

/** El SO-101 del catálogo, con mallas STL y sin marcos: el otro brazo del catálogo. */
export function So101(): JSX.Element {
  return <ArmViewer catalogId="so101" show={[]} />;
}
