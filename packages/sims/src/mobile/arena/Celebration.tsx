import { useEffect, useRef } from 'react';
import type { JSX, RefObject } from 'react';
import { useT } from '@trayectoria/i18n';

import { challengeText } from './ChallengesTab';
import type { ChallengeId } from './challenges';

/** Confetti pieces and how long they fall, in milliseconds. */
const PIECES = 90;
const FALL_MS = 2600;
const COLOR_TOKENS = [
  '--color-physical',
  '--color-primary',
  '--color-success',
  '--color-data-4',
  '--color-warning',
];

/**
 * Confetti on a canvas over the arena. Decorative and deterministic (the pieces are spread by
 * their index, not at random), and skipped when the learner asks for reduced motion.
 */
function useConfetti(ref: RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const context = canvas.getContext('2d');
    if (context === null) return undefined;
    const style = getComputedStyle(canvas);
    const colors = COLOR_TOKENS.map((name) => style.getPropertyValue(name).trim());
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number): void => {
      start ??= now;
      const k = (now - start) / FALL_MS;
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < PIECES; i += 1) {
        const spread = ((i * 7919) % 1000) / 1000;
        const x = canvas.width * (0.5 + (spread - 0.5) * (0.4 + k * 1.4));
        const y = canvas.height * (-0.05 + k * (0.7 + ((i * 31) % 50) / 50));
        context.fillStyle = colors[i % colors.length] ?? '';
        context.globalAlpha = Math.max(1 - k, 0);
        context.fillRect(x, y, 8, 4 + (i % 3) * 3);
      }
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref]);
}

export interface CelebrationProps {
  readonly id: ChallengeId;
  readonly onNext: (() => void) | null;
  readonly onClose: () => void;
}

/** «Cerrar» (focused on open) and, when there is one, «Siguiente reto». */
function CelebrationActions({
  closeRef,
  onNext,
  onClose,
}: Pick<CelebrationProps, 'onNext' | 'onClose'> & {
  closeRef: RefObject<HTMLButtonElement | null>;
}): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-wrap justify-end gap-2 pt-2">
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="min-h-11 rounded-md border border-border px-4 font-semibold text-fg hover:border-fg-muted"
      >
        {t('sims.arena.challenges.close')}
      </button>
      {onNext === null ? null : (
        <button
          type="button"
          onClick={onNext}
          className="min-h-11 rounded-md bg-primary px-4 font-semibold text-primary-fg hover:bg-primary-hover"
        >
          {t('sims.arena.challenges.next')}
        </button>
      )}
    </div>
  );
}

/** «¡Reto superado!»: what the challenge taught, over a burst of confetti. */
export function Celebration({ id, onNext, onClose }: CelebrationProps): JSX.Element {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const close = useRef<HTMLButtonElement | null>(null);
  useConfetti(canvas);
  useEffect(() => close.current?.focus(), []);
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-bg/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arena-celebration-title"
    >
      <canvas
        ref={canvas}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      <div className="relative flex max-w-form-card flex-col gap-3 rounded-lg border border-physical bg-bg-raised p-6 shadow-md">
        <p className="font-mono text-sm text-physical">{t('sims.arena.challenges.passed')}</p>
        <h2 id="arena-celebration-title" className="text-2xl font-semibold text-fg">
          {challengeText(t, id, 'title')}
        </h2>
        <p className="text-xs font-semibold uppercase text-fg-muted">
          {t('sims.arena.challenges.learned')}
        </p>
        <p className="text-base text-fg">{challengeText(t, id, 'learned')}</p>
        <CelebrationActions closeRef={close} onNext={onNext} onClose={onClose} />
      </div>
    </div>
  );
}
