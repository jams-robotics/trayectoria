import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import { SPEEDS } from '@trayectoria/widgets/SimControls';
import type { SimulationDriver } from '@trayectoria/widgets';

// F4-02b (#128, decision 4): the mobile bottom bar (docs/DESIGN.md §9.7): 56 px tall,
// Reproducir, Pausa, Paso, Reiniciar and speed, all 44 px.
//
// #531: the bar used to be `position: fixed`, with the island reserving its 56 px as padding on
// itself; the layout's own footer never got that padding and ended up hidden behind the bar. It
// now renders in the normal flow at the end of the island and only pins itself to the viewport's
// bottom edge with `position: sticky`, which never covers content after it (the footer). It also
// no longer omits «Paso» (#128, decision 4 is superseded by #531): it reuses the action and the
// i18n key desktop's `SimControls` uses, so the two agree on what "Paso" does and says. This bar
// still does not reuse `SimControls` itself: that component fixes the order Reproducir · Pausa ·
// Paso · Reiniciar · Velocidad · reloj and always shows the clock, which does not fit here.
//
// #531 (correction round): the island renders inside the page's own padded `<section>`
// (`px-5 md:px-8` in `movil.astro`), so a plain in-flow element inherits that padding and is
// narrower than the viewport — the bar sat ~36 px from the left edge and the speed select fell
// off the right at 390 px. `left: 50%; margin-left: -50vw` (the textbook full-bleed trick) does
// not fix that here: `50%` resolves against the bar's own containing block (the padded column,
// e.g. 350 px), not the viewport, so it undershoots by however wide that padding is. What is
// independent of the padding's exact value is the *difference* between the viewport and the
// container: `calc((100vw - 100%) / 2)` is exactly that padding, on each side, whatever it is (and
// zero once nothing constrains the column, i.e. it degrades safely). Negative margins of that
// size push the bar out to the viewport edges without touching `movil.astro` or `Base.astro` (out
// of scope). `100vw` never includes a scrollbar here because this bar only mounts under
// `MOBILE_MEDIA_QUERY` (`useMediaQuery.ts`), where mobile browsers do not reserve gutter width for
// one. The buttons' padding and the bar's own gap also shrink so all four buttons and the select
// fit at 360 px.

/** Height of the bar, in pixels (docs/DESIGN.md §9.7). */
export const BOTTOM_BAR_HEIGHT_PX = 56;

/** Breaks the bar out of the page's padded `<section>` to span the full viewport width. */
const FULL_BLEED_STYLE = {
  marginLeft: 'calc((100% - 100vw) / 2)',
  marginRight: 'calc((100% - 100vw) / 2)',
} as const;

// `h-11` is 80 px in this design system's remapped scale (`--space-11`, tokens.css), not 44 px:
// the true 44 px minimum touch target is the arbitrary value `h-[44px]`, the same one every other
// 44 px target in `apps/web` uses (`ThemeToggle.tsx`, `fields.tsx`, `MemberList.tsx`, …).
const BUTTON =
  'inline-flex h-[44px] min-w-[44px] items-center justify-center rounded-sm border px-2 text-sm ' +
  'font-semibold disabled:cursor-default disabled:opacity-45 focus-visible:outline-color-focus ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2';
const PRIMARY = `${BUTTON} bg-primary text-primary-fg border-primary`;
const SECONDARY = `${BUTTON} bg-bg-raised text-fg border-border`;
const SELECT =
  'border-border bg-bg text-fg h-[44px] min-w-[44px] rounded-sm border px-1 font-mono text-sm ' +
  'tabular-nums focus-visible:outline-color-focus focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2';

export interface BottomBarProps {
  readonly driver: SimulationDriver<unknown>;
}

/** The four buttons, in the fixed order Reproducir · Pausa · Paso · Reiniciar. */
function Buttons({ driver, t }: { driver: SimulationDriver<unknown>; t: Translate }): JSX.Element {
  return (
    <>
      <button type="button" className={PRIMARY} onClick={driver.play} disabled={driver.running}>
        {t('widgets.SimControls.play')}
      </button>
      <button type="button" className={SECONDARY} onClick={driver.pause} disabled={!driver.running}>
        {t('widgets.SimControls.pause')}
      </button>
      <button type="button" className={SECONDARY} onClick={driver.step}>
        {t('widgets.SimControls.step')}
      </button>
      <button type="button" className={SECONDARY} onClick={driver.reset}>
        {t('widgets.SimControls.reset')}
      </button>
    </>
  );
}

/** Playback controls, sticky to the bottom edge on mobile. */
export function BottomBar({ driver }: BottomBarProps): JSX.Element {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t('sims.mobilePage.controls')}
      data-testid="sim-bottom-bar"
      className="border-border bg-bg sticky bottom-0 z-10 flex items-center gap-1 border-t px-2"
      style={{
        ...FULL_BLEED_STYLE,
        height: `${String(BOTTOM_BAR_HEIGHT_PX)}px`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <Buttons driver={driver} t={t} />
      <select
        className={SELECT}
        aria-label={t('widgets.SimControls.speed')}
        value={driver.speed}
        onChange={(event) => {
          driver.setSpeed(Number(event.target.value));
        }}
      >
        {SPEEDS.map((speed) => (
          <option key={speed} value={speed}>
            {t('widgets.SimControls.speedOption', { speed })}
          </option>
        ))}
      </select>
    </div>
  );
}
