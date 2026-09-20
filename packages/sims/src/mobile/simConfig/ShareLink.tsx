import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { SimConfig } from '@trayectoria/robot-spec';

import { SHARE_PARAM, encode, shareLink } from './codec';

// F4-05 (#131, decisión 6): «Copiar enlace». El enlace se calcula del estado en curso —cada vez
// que la configuración cambia—, se muestra en un campo de solo lectura para poder leerlo o
// seleccionarlo a mano, y el botón lo lleva al portapapeles con un toast (docs/DESIGN.md §5).
//
// #182 (decisión 2): una configuración que no cabe en `MAX_LINK_CHARS` deja el campo vacío y el
// botón activo; al pulsarlo no se copia nada y se avisa con `tooLong`. Antes el enlace se
// mostraba igualmente y no abría al otro lado.

const BUTTON =
  'border-border bg-bg-raised text-fg inline-flex h-11 items-center rounded-md border px-3 ' +
  'text-sm font-semibold hover:border-fg-muted focus-visible:outline-color-focus ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2';
const FIELD =
  'border-border bg-bg text-fg-muted h-11 min-w-0 flex-1 rounded-md border px-3 font-mono ' +
  'text-xs focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

/** Por qué no se copió el enlace, cuando el motivo no es el portapapeles. */
export type CopyFailure = 'tooLong';

export interface ShareLinkProps {
  /** La configuración que el enlace debe reproducir. */
  readonly config: SimConfig;
  /** Origen del enlace; el de la página cuando no se da (los tests pasan uno fijo). */
  readonly origin?: string;
  /**
   * Se llama tras copiar, con `true` si el portapapeles aceptó el texto. Con `false` y `tooLong`
   * no hubo nada que copiar: la configuración no cabe en un enlace.
   */
  readonly onCopied: (copied: boolean, reason?: CopyFailure) => void;
}

/** El estado del enlace: aún codificando, listo, o más largo de lo que un enlace admite. */
interface LinkState {
  /** El enlace listo para copiar; vacío mientras se codifica y cuando no cabe. */
  readonly link: string;
  /** La configuración no cabe en `MAX_LINK_CHARS`: no hay enlace que dar. */
  readonly tooLong: boolean;
}

const ENCODING: LinkState = { link: '', tooLong: false };

/** El enlace de `config`, recalculado cada vez que la configuración cambia. */
function useLink(config: SimConfig, origin: string | undefined): LinkState {
  const [state, setState] = useState<LinkState>(ENCODING);
  useEffect(() => {
    let live = true;
    setState(ENCODING);
    void encode(config).then((result) => {
      if (!live) return;
      if (!result.ok) {
        setState({ link: '', tooLong: true });
        return;
      }
      const base = origin ?? (typeof location === 'undefined' ? '' : location.origin);
      setState({ link: shareLink(result.value, base), tooLong: false });
    });
    return () => {
      live = false;
    };
  }, [config, origin]);
  return state;
}

/**
 * Lleva `link` al portapapeles, o avisa de que no hay enlace porque la configuración no cabe
 * (#182): en ese caso no se toca el portapapeles, para no borrar lo que hubiera dentro.
 */
function copyLink(
  state: LinkState,
  onCopied: (copied: boolean, reason?: CopyFailure) => void,
): void {
  if (state.tooLong) {
    onCopied(false, 'tooLong');
    return;
  }
  navigator.clipboard.writeText(state.link).then(
    () => {
      onCopied(true);
    },
    () => {
      onCopied(false);
    },
  );
}

/**
 * El enlace que reproduce la simulación en curso y el botón que lo copia. El texto se muestra
 * además en un campo de solo lectura: un navegador que niegue el permiso del portapapeles deja
 * igualmente el enlace a la vista para copiarlo a mano.
 */
export function ShareLink({ config, origin, onCopied }: ShareLinkProps): JSX.Element {
  const t = useT();
  const state = useLink(config, origin);
  const { link, tooLong } = state;
  return (
    <div className="flex flex-col gap-2">
      <label className="text-fg-muted text-sm" htmlFor="sim-config-link">
        {t('sims.simConfig.link')}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="sim-config-link"
          type="text"
          readOnly
          className={FIELD}
          data-testid="sim-config-link"
          data-param={SHARE_PARAM}
          value={link}
        />
        <button
          type="button"
          className={BUTTON}
          data-testid="sim-config-copy"
          disabled={link === '' && !tooLong}
          onClick={() => {
            copyLink(state, onCopied);
          }}
        >
          {t('sims.simConfig.copy')}
        </button>
      </div>
    </div>
  );
}
