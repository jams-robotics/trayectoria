import { useEffect } from 'react';
import type { JSX } from 'react';

import { startRobotPersistence } from '../../stores/robotPersistence';

/**
 * Único punto que conecta «Mi robot» con la sesión en toda página, no solo `/cuenta` (#238,
 * decisión del orquestador de PR #250, segunda ronda): una isla `client:load` en el layout
 * base, junto al patrón ya usado por el progreso (`ProgressSession`, §3.1).
 *
 * Antes solo `MyRobotIsland` llamaba a `startRobotPersistence()`, así que `currentOwnerId`
 * (`packages/widgets/src/stores/myRobot.ts`) se quedaba en `null` fuera de `/cuenta`: un
 * alumno con sesión veía el robot de referencia en vez del suyo en los simuladores y en los
 * temas. `MyRobotIsland` ya no monta la persistencia, para no duplicarla.
 *
 * No renderiza nada: las islas que muestran el robot leen `$myRobot`, no props.
 */
export function RobotSession(): JSX.Element {
  useEffect(() => startRobotPersistence(), []);
  return <></>;
}
