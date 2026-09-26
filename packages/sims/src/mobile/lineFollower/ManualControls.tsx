import { useRef } from 'react';
import type { JSX, ReactNode, RefObject } from 'react';
import { useT } from '@trayectoria/i18n';
import { maxWheelSpeed_radps } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { useManualKeyboard } from './useManualKeyboard';
import type { ManualDrive, ManualKey } from './useManualKeyboard';

// F4-04 (#130, decisión 3): los botones táctiles del modo manual, con la misma semántica que el
// teclado. 44 px de lado (docs/DESIGN.md §5: altura mínima 44 en móvil y acciones principales).

/** Lado de cada botón, en píxeles (docs/DESIGN.md §5). */
const BUTTON_SIZE_PX = 44;

/** Las cuatro direcciones y el glifo con el que se dibujan, en el orden del pad. */
const KEYS: ReadonlyArray<readonly [ManualKey, string]> = [
  ['up', '↑'],
  ['left', '←'],
  ['down', '↓'],
  ['right', '→'],
];

const BUTTON =
  'border-border bg-bg-raised text-fg inline-flex items-center justify-center rounded-sm ' +
  'border text-lg transition-colors duration-[120ms] hover:border-fg-muted ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

export interface ManualControlsProps {
  /** El mando que el widget comparte con el teclado. */
  readonly drive: ManualDrive;
}

/**
 * Pad de cuatro botones para conducir en manual sin teclado: `pointerdown` aplica la dirección y
 * `pointerup`/`pointercancel` la sueltan, igual que `keydown`/`keyup`. Solo se muestra con el
 * controlador manual seleccionado, que es quien decide el widget.
 */
export function ManualControls({ drive }: ManualControlsProps): JSX.Element {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t('sims.manual.pad')}
      className="grid w-fit grid-cols-3 grid-rows-2 gap-1"
      data-testid="manual-controls"
    >
      {KEYS.map(([key, glyph]) => (
        <button
          key={key}
          type="button"
          className={`${BUTTON} ${key === 'up' ? 'col-start-2' : ''}`}
          style={{ width: BUTTON_SIZE_PX, height: BUTTON_SIZE_PX }}
          aria-label={t(`sims.manual.key.${key}`)}
          data-testid={`manual-${key}`}
          onPointerDown={(event) => {
            event.preventDefault();
            drive.press(key);
          }}
          onPointerUp={() => {
            drive.release(key);
          }}
          onPointerCancel={() => {
            drive.release(key);
          }}
          onPointerLeave={() => {
            drive.release(key);
          }}
        >
          <span aria-hidden="true">{glyph}</span>
        </button>
      ))}
    </div>
  );
}

/** Ayuda de interacción del modo manual, mono `xs` abajo-izquierda del visor (DESIGN §6). */
export function ManualHelp(): JSX.Element {
  const t = useT();
  return (
    <p className="text-fg-muted font-mono text-xs" data-testid="manual-help">
      {t('sims.manual.help')}
    </p>
  );
}

/** Atajos que el visor manual anuncia (#130, decisión 2), en la sintaxis de `aria-keyshortcuts`. */
export const MANUAL_KEYSHORTCUTS = 'ArrowUp ArrowDown ArrowLeft ArrowRight Space';

/**
 * El mando manual de un robot: el teclado del visor, con el techo de velocidad que el robot
 * admite, y el Espacio enganchado a la reproducción del widget. `enabled` lo ata al controlador
 * manual, así que con otro seleccionado nadie escucha.
 */
export function useManualMode(
  viewerRef: RefObject<HTMLElement | null>,
  options: { spec: RobotSpec; enabled: boolean; onTogglePlay: () => void },
): ManualDrive {
  const { spec, enabled, onTogglePlay } = options;
  const latest = useRef(onTogglePlay);
  latest.current = onTogglePlay;
  return useManualKeyboard(viewerRef, {
    omegaMax_radps: spec.mobile === undefined ? 0 : maxWheelSpeed_radps(spec.mobile),
    enabled,
    onTogglePlay: () => {
      latest.current();
    },
  });
}

/**
 * La caja del visor en modo manual: el visor con `tabIndex = 0` para recibir el foco del teclado
 * y, debajo, el pad táctil y la ayuda de interacción. Fuera del modo manual es el visor y nada
 * más, con el mismo elemento enfocable para que el foco no salte al cambiar de controlador.
 */
export function ManualViewer({
  viewerRef,
  manual,
  drive,
  children,
}: {
  viewerRef: RefObject<HTMLDivElement | null>;
  manual: boolean;
  drive: ManualDrive;
  children: ReactNode;
}): JSX.Element {
  const t = useT();
  return (
    <div
      ref={viewerRef}
      tabIndex={0}
      // A tab stop needs a name, and a named `div` needs a role: ARIA prohibits `aria-label` on a
      // generic element (F7-01). Outside manual mode the box is named after the scene it holds.
      role="group"
      aria-label={manual ? t('sims.manual.pad') : t('sims.lineFollower.scene')}
      {...(manual ? { 'aria-keyshortcuts': MANUAL_KEYSHORTCUTS } : {})}
      className="focus-visible:outline-color-focus rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      data-testid="line-follower-viewport"
    >
      {children}
      {manual ? (
        <div className="mt-2 flex flex-col gap-2">
          <ManualControls drive={drive} />
          <ManualHelp />
        </div>
      ) : null}
    </div>
  );
}
