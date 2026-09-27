import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { SimConfig } from '@trayectoria/robot-spec';

import { SHARE_PARAM, encode, shareLink } from './codec';

// F4-05 (#131, decision 6): «Copiar enlace». The link is computed from the current state —every time
// the configuration changes—, shown in a read-only field so it can be read or
// selected by hand, and the button takes it to the clipboard with a toast (docs/DESIGN.md §5).
//
// #182 (decision 2): a configuration that does not fit in `MAX_LINK_CHARS` leaves the field empty and the
// button enabled; pressing it copies nothing and warns with `tooLong`. Before, the link was
// shown anyway and did not open on the other side.

const BUTTON =
  'border-border bg-bg-raised text-fg inline-flex h-11 items-center rounded-md border px-3 ' +
  'text-sm font-semibold hover:border-fg-muted focus-visible:outline-color-focus ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2';
const FIELD =
  'border-border bg-bg text-fg-muted h-11 min-w-0 flex-1 rounded-md border px-3 font-mono ' +
  'text-xs focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

/** Why the link was not copied, when the reason is not the clipboard. */
export type CopyFailure = 'tooLong';

export interface ShareLinkProps {
  /** The configuration the link must reproduce. */
  readonly config: SimConfig;
  /** Origin of the link; the page's one when not given (the tests pass a fixed one). */
  readonly origin?: string;
  /**
   * Called after copying, with `true` if the clipboard accepted the text. With `false` and `tooLong`
   * there was nothing to copy: the configuration does not fit in a link.
   */
  readonly onCopied: (copied: boolean, reason?: CopyFailure) => void;
}

/** The state of the link: still encoding, ready, or longer than a link allows. */
interface LinkState {
  /** The link ready to copy; empty while encoding and when it does not fit. */
  readonly link: string;
  /** The configuration does not fit in `MAX_LINK_CHARS`: there is no link to give. */
  readonly tooLong: boolean;
}

const ENCODING: LinkState = { link: '', tooLong: false };

/** The link of `config`, recomputed every time the configuration changes. */
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
 * Takes `link` to the clipboard, or warns that there is no link because the configuration does not fit
 * (#182): in that case the clipboard is not touched, so as not to erase whatever was inside.
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
 * The link that reproduces the current simulation and the button that copies it. The text is also
 * shown in a read-only field: a browser that denies the clipboard permission still leaves
 * the link in view to copy it by hand.
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
