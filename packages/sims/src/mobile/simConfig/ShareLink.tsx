import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { SimConfig } from '@trayectoria/robot-spec';

import { SHARE_PARAM, encode, shareLink } from './codec';

// F4-05 (#131, decisión 6): «Copiar enlace». El enlace se calcula del estado en curso —cada vez
// que la configuración cambia—, se muestra en un campo de solo lectura para poder leerlo o
// seleccionarlo a mano, y el botón lo lleva al portapapeles con un toast (docs/DESIGN.md §5).

const BUTTON =
  'border-border bg-bg-raised text-fg inline-flex h-11 items-center rounded-md border px-3 ' +
  'text-sm font-semibold hover:border-fg-muted focus-visible:outline-color-focus ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2';
const FIELD =
  'border-border bg-bg text-fg-muted h-11 min-w-0 flex-1 rounded-md border px-3 font-mono ' +
  'text-xs focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

export interface ShareLinkProps {
  /** La configuración que el enlace debe reproducir. */
  readonly config: SimConfig;
  /** Origen del enlace; el de la página cuando no se da (los tests pasan uno fijo). */
  readonly origin?: string;
  /** Se llama tras copiar, con `true` si el portapapeles aceptó el texto. */
  readonly onCopied: (copied: boolean) => void;
}

/** El enlace de `config`, recalculado cada vez que la configuración cambia. */
function useLink(config: SimConfig, origin: string | undefined): string {
  const [link, setLink] = useState('');
  useEffect(() => {
    let live = true;
    void encode(config).then((text) => {
      const base = origin ?? (typeof location === 'undefined' ? '' : location.origin);
      if (live) setLink(shareLink(text, base));
    });
    return () => {
      live = false;
    };
  }, [config, origin]);
  return link;
}

/**
 * El enlace que reproduce la simulación en curso y el botón que lo copia. El texto se muestra
 * además en un campo de solo lectura: un navegador que niegue el permiso del portapapeles deja
 * igualmente el enlace a la vista para copiarlo a mano.
 */
export function ShareLink({ config, origin, onCopied }: ShareLinkProps): JSX.Element {
  const t = useT();
  const link = useLink(config, origin);
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
          disabled={link === ''}
          onClick={() => {
            navigator.clipboard.writeText(link).then(
              () => {
                onCopied(true);
              },
              () => {
                onCopied(false);
              },
            );
          }}
        >
          {t('sims.simConfig.copy')}
        </button>
      </div>
    </div>
  );
}
