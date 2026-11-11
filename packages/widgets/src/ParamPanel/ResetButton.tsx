import { useRef } from 'react';
import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import type { ParamChangeHandler, ParamPanelParam } from './ParamPanel';

/**
 * «Valores iniciales» (v1.5): every slider goes back, through `onChange`, to the first value it
 * showed, which is the one the topic opened the widget with; then `onReset` runs, if any.
 */
export function ResetButton({
  params,
  onChange,
  onReset,
  t,
}: {
  params: readonly ParamPanelParam[];
  onChange: ParamChangeHandler;
  onReset: (() => void) | undefined;
  t: Translate;
}): JSX.Element {
  const opening = useRef(new Map<string, number>());
  // A key seen for the first time keeps its value: sliders that appear later still have one.
  for (const param of params) {
    if (!opening.current.has(param.key)) opening.current.set(param.key, param.value);
  }
  return (
    <button
      type="button"
      className="bg-bg-raised text-fg border-border hover:border-fg-muted mt-4 inline-flex h-9 w-fit items-center rounded-sm border px-3 text-sm font-semibold transition-colors duration-[120ms]"
      onClick={() => {
        for (const param of params) {
          const value = opening.current.get(param.key);
          if (value !== undefined && value !== param.value && param.disabled !== true) {
            onChange(param.key, value);
          }
        }
        onReset?.();
      }}
    >
      {t('widgets.ParamPanel.reset')}
    </button>
  );
}
