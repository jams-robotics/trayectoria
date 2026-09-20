import type { PidParams } from '@trayectoria/sim-core';

import type { Pose } from './model';

// F4-03 (#129, decisión 2): las métricas de la instrumentación, puras y sin reloj de plataforma.
// Todo número sale del estado del modelo, que lleva su propio tiempo simulado.

/** Una vuelta cerrada: lo que tardó, lo que recorrió y a qué velocidad media. */
export interface Lap {
  readonly lapTime_s: number;
  readonly distance_m: number;
  readonly avgSpeed_mps: number;
}

/** Cronómetro de vueltas: las cerradas hasta ahora y el mejor tiempo entre ellas. */
export interface LapTimer {
  readonly laps: readonly Lap[];
  /** Mejor tiempo, en segundos; `null` mientras no hay ninguna vuelta cerrada. */
  readonly best_s: number | null;
  /** Tiempo simulado en que empezó la vuelta en curso, en segundos. */
  readonly startedAt_s: number;
  /** Odómetro del modelo al empezar la vuelta en curso, en metros. */
  readonly startedAtDistance_m: number;
}

/**
 * Velocidad media de una vuelta: la distancia que el robot recorrió dividida por lo que tardó.
 * Una vuelta de duración nula (o negativa, que no puede ocurrir con tiempo simulado creciente)
 * da 0 en lugar de un infinito que la tarjeta no sabría mostrar.
 */
export function avgSpeed_mps(distance_m: number, lapTime_s: number): number {
  if (!(lapTime_s > 0)) return 0;
  return distance_m / lapTime_s;
}

/** Cronómetro recién puesto a cero: sin vueltas y con la primera empezando en `t = 0`. */
export function createLapTimer(): LapTimer {
  return { laps: [], best_s: null, startedAt_s: 0, startedAtDistance_m: 0 };
}

/**
 * Cierra la vuelta en curso en el instante simulado `t_s`, con el odómetro del modelo en
 * `distance_m`, y abre la siguiente ahí mismo. El tiempo y la distancia de la vuelta son
 * diferencias contra el arranque de la vuelta, así que no dependen del reparto de fotogramas:
 * dos corridas con los mismos pasos dan exactamente la misma vuelta (#155).
 */
export function recordLap(timer: LapTimer, t_s: number, distance_m: number): LapTimer {
  const lapTime_s = t_s - timer.startedAt_s;
  const lapDistance_m = distance_m - timer.startedAtDistance_m;
  const lap: Lap = {
    lapTime_s,
    distance_m: lapDistance_m,
    avgSpeed_mps: avgSpeed_mps(lapDistance_m, lapTime_s),
  };
  return {
    laps: [...timer.laps, lap],
    best_s: timer.best_s === null ? lapTime_s : Math.min(timer.best_s, lapTime_s),
    startedAt_s: t_s,
    startedAtDistance_m: distance_m,
  };
}

/** Los tres términos del PID en una muestra, más el integrador que deja para la siguiente. */
export interface PidTerms {
  readonly P: number;
  readonly I: number;
  readonly D: number;
  /** Integral del error tras este paso, ya saturada a `±iMax`. */
  readonly integral: number;
}

/** Satura `x` a `±limit`, la misma regla de anti-windup de `packages/sim-core/src/control/pid.ts`. */
function clamp(x: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, x));
}

/**
 * Términos `P`, `I` y `D` de un paso del PID, con la fórmula y el anti-windup de sim-core
 * (`createPidController`): `integral = clamp(integral + e·dt, ±iMax)`, `D` por diferencia hacia
 * atrás y cero cuando no hay tiempo transcurrido. Su suma es la `u` que el controlador aplica,
 * que es lo que hace comparable la gráfica con la carrera que se está viendo.
 *
 * El controlador de sim-core no publica sus términos por separado — solo el `WheelCommand` —, así
 * que se reproducen aquí con los `params` vigentes en cada muestra (#161: las ganancias se leen en
 * cada `update()`, de modo que mover un slider cambia los términos desde la muestra siguiente).
 */
export function pidTerms(
  params: PidParams,
  e: number,
  integral: number,
  ePrev: number,
  dt_s: number,
): PidTerms {
  const next = clamp(integral + e * dt_s, params.iMax);
  const derivative = dt_s > 0 ? (e - ePrev) / dt_s : 0;
  return {
    P: params.kp * e,
    I: params.ki * next,
    D: params.kd * derivative,
    integral: next,
  };
}

/** El evento de línea perdida: la pose en que ocurrió. */
export interface LostEvent {
  readonly pose: Pose;
}

/**
 * El flanco de subida de `lineLost`: devuelve la pose en que el arreglo acaba de perder la línea,
 * o `null` mientras no ocurra. Seguir perdido no lo vuelve a disparar, así que la simulación se
 * pausa una sola vez y el marcador se queda donde se perdió.
 */
export function lostEvent(
  prevLineLost: boolean,
  lineLost: boolean,
  pose: Pose,
): LostEvent | null {
  if (prevLineLost || !lineLost) return null;
  return { pose };
}
