import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { WheelCommand } from '@trayectoria/sim-core';

// F4-04 (#130, decisión 2): el teclado del modo manual. Los oyentes van en el elemento del visor
// y no en `window` ni en `document` (prohibición de CLAUDE.md fuera de `apps/web`), así que solo
// conducen las teclas mientras el visor tiene el foco.

/** Paso de la velocidad base por pulsación de ↑ o ↓, en rad/s (#130, decisión 2). */
export const MANUAL_STEP_RADPS = 0.5;

/** Diferencia entre ruedas mientras ← o → está pulsada, en rad/s (#130, decisión 2). */
export const MANUAL_DIFF_RADPS = 2;

/** Las cuatro direcciones que conducen el robot, y con ellas los botones táctiles. */
export type ManualKey = 'up' | 'down' | 'left' | 'right';

/** Qué dirección mueve cada tecla del teclado; el resto de teclas no son del modo manual. */
const KEY_BY_NAME: Readonly<Record<string, ManualKey>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Teclas que alternan reproducción y pausa (docs/DESIGN.md §5: Espacio play/pausa). */
const PLAY_KEYS: readonly string[] = [' ', 'Spacebar'];

/**
 * Comando de ruedas de una base y una diferencia. `diff_radps` negativa gira a la derecha: la
 * rueda izquierda corre más que la derecha (#130, decisión 2: → da `ωL = base + 2`,
 * `ωR = base − 2`, es decir `diff = −2`).
 */
export function commandOf(omegaBase_radps: number, diff_radps: number): WheelCommand {
  return {
    omegaL_radps: omegaBase_radps - diff_radps,
    omegaR_radps: omegaBase_radps + diff_radps,
  };
}

/** `value` dentro de `[0, max]`; la marcha atrás no es del modo manual de F4-04. */
function clamped(value: number, max_radps: number): number {
  return Math.min(Math.max(value, 0), max_radps);
}

export interface UseManualKeyboardOptions {
  /** Velocidad de rueda máxima del robot, en rad/s; techo de la velocidad base. */
  readonly omegaMax_radps: number;
  /** Si el hook escucha; con otro controlador seleccionado no conduce nadie. */
  readonly enabled?: boolean;
  /** Se llama al pulsar Espacio, para que el widget alterne reproducción y pausa. */
  readonly onTogglePlay?: () => void;
}

export interface ManualDrive {
  /** Velocidad base de las dos ruedas, en rad/s. */
  readonly omegaBase_radps: number;
  /** Diferencia aplicada mientras ← o → está pulsada, en rad/s. */
  readonly diff_radps: number;
  /** El comando que el modelo recibe como `input.command`. */
  readonly command: WheelCommand;
  /** Aplica una dirección, como si se pulsara su tecla; lo usan los botones táctiles. */
  readonly press: (key: ManualKey) => void;
  /** Suelta una dirección; solo ← y → tienen efecto al soltarse. */
  readonly release: (key: ManualKey) => void;
}

/**
 * Conduce el robot con el teclado mientras el visor tiene el foco (#130, decisión 2): ↑ y ↓
 * cambian la velocidad base en pasos de `MANUAL_STEP_RADPS` dentro de `[0, omegaMax_radps]`, ←
 * y → fijan la diferencia en `±MANUAL_DIFF_RADPS` mientras se mantienen pulsadas y la devuelven
 * a 0 al soltarlas, y Espacio alterna reproducción y pausa.
 *
 * `press` y `release` exponen la misma semántica sin teclado, que es lo que usan los botones
 * táctiles de `ManualControls` con `pointerdown` y `pointerup`.
 */
export function useManualKeyboard(
  viewerRef: RefObject<HTMLElement | null>,
  options: UseManualKeyboardOptions,
): ManualDrive {
  const { omegaMax_radps, enabled = true, onTogglePlay } = options;
  const [omegaBase_radps, setBase] = useState(0);
  const [diff_radps, setDiff] = useState(0);

  const press = useCallback(
    (key: ManualKey): void => {
      if (key === 'up') setBase((base) => clamped(base + MANUAL_STEP_RADPS, omegaMax_radps));
      else if (key === 'down') setBase((base) => clamped(base - MANUAL_STEP_RADPS, omegaMax_radps));
      else setDiff(key === 'right' ? -MANUAL_DIFF_RADPS : MANUAL_DIFF_RADPS);
    },
    [omegaMax_radps],
  );

  const release = useCallback((key: ManualKey): void => {
    if (key === 'left' || key === 'right') setDiff(0);
  }, []);

  // Un robot más lento no puede seguir corriendo a la base del anterior: el techo baja con él.
  useEffect(() => {
    setBase((base) => clamped(base, omegaMax_radps));
  }, [omegaMax_radps]);

  useKeyListeners(viewerRef, { enabled, press, release, onTogglePlay });

  return { omegaBase_radps, diff_radps, command: commandOf(omegaBase_radps, diff_radps), press, release };
}

/** Lo que los oyentes del visor hacen con cada tecla; un ref lo mantiene siempre al día. */
interface KeyHandlers {
  enabled: boolean;
  press: (key: ManualKey) => void;
  release: (key: ManualKey) => void;
  onTogglePlay: (() => void) | undefined;
}

/** El oyente de `keydown`: Espacio alterna la reproducción y las flechas conducen. */
function keyDownListener(latest: RefObject<KeyHandlers>): (event: KeyboardEvent) => void {
  return (event) => {
    const { press, onTogglePlay } = latest.current;
    if (PLAY_KEYS.includes(event.key)) {
      event.preventDefault();
      onTogglePlay?.();
      return;
    }
    const key = KEY_BY_NAME[event.key];
    if (key === undefined) return;
    event.preventDefault();
    press(key);
  };
}

/** El oyente de `keyup`: solo las flechas se sueltan, y con ellas la diferencia. */
function keyUpListener(latest: RefObject<KeyHandlers>): (event: KeyboardEvent) => void {
  return (event) => {
    const key = KEY_BY_NAME[event.key];
    if (key === undefined) return;
    event.preventDefault();
    latest.current.release(key);
  };
}

/**
 * Los oyentes de teclado del visor. Van en el elemento, así que solo se disparan con el foco
 * dentro de él; se quitan al desmontar o al deshabilitar el modo manual.
 */
function useKeyListeners(viewerRef: RefObject<HTMLElement | null>, handlers: KeyHandlers): void {
  const latest = useRef(handlers);
  latest.current = handlers;
  const { enabled } = handlers;

  useEffect(() => {
    const element = viewerRef.current;
    if (!enabled || element === null) return undefined;
    const onKeyDown = keyDownListener(latest);
    const onKeyUp = keyUpListener(latest);
    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('keyup', onKeyUp);
    return () => {
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('keyup', onKeyUp);
    };
  }, [viewerRef, enabled]);
}
