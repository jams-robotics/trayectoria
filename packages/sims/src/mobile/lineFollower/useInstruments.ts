import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_DT_S, trackLength_m } from '@trayectoria/sim-core';
import type { PidParams, Track } from '@trayectoria/sim-core';
import { RingBuffer } from '@trayectoria/widgets';

import { createLapTimer, pidTerms, recordLap } from './metrics';
import type { LapTimer } from './metrics';
import type { LineFollowerState, Pose } from './model';
import type { LineFollowerApi } from './useLineFollower';

// F4-03 (#129, decisiones 3, 4 y 5): el muestreo de la instrumentación. Es el único sitio que
// mira la carrera fotograma a fotograma; las métricas en sí son puras y viven en `metrics.ts`.

/** Ventana deslizante de las gráficas, en segundos (decisión 4). */
export const PLOT_WINDOW_S = 10;

/**
 * Muestras que cabe guardar por gráfica. Se toma **una por fotograma** (decisión 4), así que a
 * 60 fps la ventana de 10 s son 600; el doble deja margen para pantallas de 120 Hz sin que el
 * anillo se coma la ventana. Con `dt_s` por defecto un fotograma son varios pasos del modelo, de
 * modo que la gráfica muestrea la carrera, no cada integración: es la resolución que el ojo
 * distingue y la que `Plot` puede redibujar sin quedarse atrás.
 */
const PLOT_CAPACITY = 2 * Math.ceil(PLOT_WINDOW_S / DEFAULT_DT_S / 10);

/** Los anillos de las cuatro gráficas: `error`, `v`, `ω` y los tres términos del PID juntos. */
export interface InstrumentBuffers {
  readonly error: RingBuffer;
  readonly v: RingBuffer;
  readonly omega: RingBuffer;
  /** Tres series en un solo anillo: `P`, `I` y `D` en ese orden (decisión 4). */
  readonly pid: RingBuffer;
}

/** Lo que la instrumentación publica al visor y a la página. */
export interface Instruments {
  readonly buffers: InstrumentBuffers;
  readonly timer: LapTimer;
  /** La pose en que se perdió la línea, mientras el aviso sigue en pie. */
  readonly lostAt: Pose | undefined;
}

/** Anillos nuevos para una carrera: uno por gráfica, con tres series en el del PID. */
function createBuffers(): InstrumentBuffers {
  return {
    error: new RingBuffer(PLOT_CAPACITY, 1),
    v: new RingBuffer(PLOT_CAPACITY, 1),
    omega: new RingBuffer(PLOT_CAPACITY, 1),
    pid: new RingBuffer(PLOT_CAPACITY, 3),
  };
}

/** Los `PidParams` vigentes, o `null` cuando el controlador en curso no es un PID. */
function pidParamsOf(params: Record<string, number> | undefined): PidParams | null {
  if (params === undefined) return null;
  const { omegaBase_radps, kp, ki, kd, iMax } = params;
  if (kp === undefined || ki === undefined || kd === undefined || iMax === undefined) return null;
  return { omegaBase_radps: omegaBase_radps ?? 0, kp, ki, kd, iMax };
}

/** El integrador y el error anterior que el muestreo del PID arrastra de una muestra a la otra. */
interface PidMemory {
  integral: number;
  ePrev: number;
  hasPrev: boolean;
}

/** Empuja la muestra de este fotograma a los cuatro anillos. */
function sample(
  buffers: InstrumentBuffers,
  state: LineFollowerState,
  pid: PidParams | null,
  memory: PidMemory,
  dt_s: number,
): void {
  const t_s = state.robot.t_s;
  const e = state.reading.linePosition;
  buffers.error.push(t_s, [e]);
  buffers.v.push(t_s, [state.robot.v_mps]);
  buffers.omega.push(t_s, [state.robot.omega_radps]);
  if (pid === null) return;
  // Los `params` vigentes en cada muestra (#161): mover una ganancia cambia los términos desde la
  // muestra siguiente, sin reconstruir nada ni perder el integrador.
  const terms = pidTerms(pid, e, memory.integral, memory.hasPrev ? memory.ePrev : e, dt_s);
  buffers.pid.push(t_s, [terms.P, terms.I, terms.D]);
  memory.integral = terms.integral;
  memory.ePrev = e;
  memory.hasPrev = true;
}

export interface UseInstrumentsOptions {
  readonly api: LineFollowerApi;
  readonly track: Track;
  /** Ganancias en curso; solo se usan cuando el controlador seleccionado es el PID. */
  readonly params?: Record<string, number>;
  /** Cierto mientras el controlador seleccionado es un PID, que es cuando hay términos. */
  readonly pid: boolean;
}

/**
 * Instrumenta la carrera en curso: muestrea el estado del modelo una vez por fotograma en los
 * anillos de las gráficas, cierra una vuelta cada vez que el contador del modelo sube y pausa la
 * simulación en cuanto el arreglo pierde la línea (decisiones 3, 4 y 5).
 *
 * Todo número sale del estado del modelo, que lleva su propio tiempo simulado: aquí no se lee
 * ningún reloj de plataforma. Reiniciar la carrera o cambiar de pista vacía los anillos, pone el
 * cronómetro a cero y borra el aviso de línea perdida.
 */
export function useInstruments({ api, track, params, pid }: UseInstrumentsOptions): Instruments {
  const length_m = useMemo(() => trackLength_m(track), [track]);
  const buffers = useMemo(createBuffers, []);
  const [timer, setTimer] = useState<LapTimer>(() => createLapTimer(length_m));
  const [lostAt, setLostAt] = useState<Pose | undefined>(undefined);
  const memory = useRef<PidMemory>({ integral: 0, ePrev: 0, hasPrev: false });
  const last = useRef({ t_s: -1, laps: 0, lost: false });
  // Lo que cambia en cada render y el efecto necesita leer sin volver a suscribirse: las ganancias
  // vigentes (#161), el driver que pausa y la longitud de la pista en curso.
  const live = useRef({ pid: pidParamsOf(params), driver: api.driver, length_m });
  live.current = { pid: pid ? pidParamsOf(params) : null, driver: api.driver, length_m };

  const { state } = api;
  useEffect(() => {
    const previous = last.current;
    // Un render que no ha avanzado el modelo no aporta muestra: `useSimulationDriver` entrega un
    // objeto nuevo en cada render, y empujar en todos dejaría el anillo creciendo con la pausa
    // puesta — y con él la gráfica redibujándose sin parar.
    if (state.robot.t_s === previous.t_s) return;
    // Un reinicio, una pista nueva o una simulación reconstruida traen el reloj hacia atrás: la
    // instrumentación empieza de cero con ellos, igual que la traza del visor.
    const restarted = state.robot.t_s < previous.t_s;
    if (restarted) {
      for (const buffer of [buffers.error, buffers.v, buffers.omega, buffers.pid]) buffer.clear();
      memory.current = { integral: 0, ePrev: 0, hasPrev: false };
      setTimer(createLapTimer(live.current.length_m));
      setLostAt(undefined);
    }
    // La muestra del estado de partida entra igual tras un reinicio, así que la gráfica vuelve a
    // arrancar con el punto de salida y no en blanco.
    const dt_s = restarted ? 0 : Math.max(state.robot.t_s - previous.t_s, 0);
    sample(buffers, state, live.current.pid, memory.current, dt_s);
    if (!restarted) {
      if (state.laps > previous.laps) {
        setTimer((current) => recordLap(current, state.robot.t_s, state.distance_m));
      }
      // El flanco de subida de `lineLost` pausa la carrera y deja el marcador donde se perdió;
      // seguir perdido no la vuelve a pausar (decisión 5).
      if (state.lineLost && !previous.lost && state.lostAt !== undefined) {
        setLostAt(state.lostAt);
        live.current.driver.pause();
      }
    }
    last.current = { t_s: state.robot.t_s, laps: state.laps, lost: state.lineLost };
  }, [state, buffers]);

  // La longitud de la pista define la velocidad media (#170): cambiar de pista reinicia la
  // simulación, y el cronómetro tiene que arrancar ya con la longitud nueva.
  useEffect(() => {
    setTimer(createLapTimer(length_m));
  }, [length_m]);

  return { buffers, timer, lostAt };
}
