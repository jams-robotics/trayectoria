import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { ArmSpec } from '@trayectoria/robot-spec';

import { PanelCard } from '../PanelCard';
import { CANCELLED_REASON, WORKSPACE_SEED, sampleWorkspaceInBatches } from './sampler';
import type { BatchSchedule } from './sampler';

// F5-03 (#136, decision 4): «Espacio de trabajo» panel. Numeric field with `n`, a button that switches
// from «Calcular» to «Cancelar» while sampling runs, a 4 px progress bar with the figure
// (docs/DESIGN.md §5) and an `aria-pressed` visibility toggle. No Spanish literal lives
// here: everything comes from the `sims.workspace.*` keys.

/** Limits of the numeric field `n` (ticket spec). */
export const N_DEFAULT = 20_000;
export const N_MIN = 100;
export const N_MAX = 200_000;
export const N_STEP = 1_000;

/** 40 px tall button of the panel (docs/DESIGN.md §5, Botón). */
const BUTTON_BASE = 'h-10 rounded-sm border px-3 text-sm';

/** Integer percentage of a `[0, 1]` fraction, for the figure next to the bar. */
function percent(progress: number): number {
  return Math.round(progress * 100);
}

/** Sampling state the panel exposes outward. */
export interface WorkspaceState {
  /** The already computed cloud, or `null` if none has been computed yet. */
  readonly points: Float32Array | null;
  /** Whether the cloud is drawn. */
  readonly visible: boolean;
}

export interface WorkspacePanelProps {
  /** The arm to sample; its joint limits define the reachable space. */
  arm: ArmSpec;
  /** Reports the cloud and its visibility every time they change. */
  onChange: (state: WorkspaceState) => void;
  /** Batch scheduler; the tests inject a synchronous one (decision 2). */
  schedule?: BatchSchedule;
}

/** What the panel needs to know about the running sampling. */
interface Sampling {
  readonly running: boolean;
  readonly progress: number;
  start: (n: number) => void;
  cancel: () => void;
}

/** Batch sampling tied to the panel's life cycle: progress, cancellation and cleanup. */
function useSampling(
  arm: ArmSpec,
  schedule: BatchSchedule | undefined,
  onPoints: (points: Float32Array) => void,
): Sampling {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef<(() => void) | null>(null);

  const cancel = useCallback((): void => {
    cancelRef.current?.();
    cancelRef.current = null;
    setRunning(false);
  }, []);

  // On unmount, a half-finished sampling is left with no one to consume it: it is aborted.
  useEffect(() => () => cancelRef.current?.(), []);

  const start = useCallback(
    (n: number): void => {
      cancelRef.current?.();
      setProgress(0);
      setRunning(true);
      const run = sampleWorkspaceInBatches(arm, n, WORKSPACE_SEED, {
        ...(schedule === undefined ? {} : { schedule }),
        onProgress: setProgress,
      });
      cancelRef.current = run.cancel;
      run.promise
        .then((points) => {
          cancelRef.current = null;
          setRunning(false);
          onPoints(points);
        })
        .catch((error: unknown) => {
          // Cancelling is a normal exit from sampling, not a failure to report.
          if (error instanceof Error && error.message === CANCELLED_REASON) return;
          cancelRef.current = null;
          setRunning(false);
        });
    },
    [arm, onPoints, schedule],
  );

  return { running, progress, start, cancel };
}

/** The 4 px bar with its figure in mono (docs/DESIGN.md §5, Barra de progreso). */
function ProgressBar({ progress, label }: { progress: number; label: string }): JSX.Element {
  const value = percent(progress);
  return (
    <div className="flex items-center gap-2" data-testid="workspace-progress">
      <div
        className="bg-border h-1 flex-1 overflow-hidden rounded-[2px]"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="bg-primary h-full" style={{ width: `${String(value)}%` }} />
      </div>
      <span className="text-fg-muted font-mono text-xs tabular-nums">{`${String(value)} %`}</span>
    </div>
  );
}

/** The numeric field for `n` (docs/DESIGN.md §5, Campo numérico). */
function CountField({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}): JSX.Element {
  const t = useT();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-fg-muted">{t('sims.workspace.count')}</span>
      <input
        type="number"
        className="border-border bg-bg h-10 w-12 rounded-sm border px-2 font-mono text-sm tabular-nums"
        value={value}
        min={N_MIN}
        max={N_MAX}
        step={N_STEP}
        disabled={disabled}
        aria-label={t('sims.workspace.count')}
        data-testid="workspace-count"
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
      />
    </label>
  );
}

/** `n` clamped to the field limits; a non-numeric value falls back to the default one. */
export function clampCount(value: number): number {
  if (!Number.isFinite(value)) return N_DEFAULT;
  return Math.min(Math.max(Math.round(value), N_MIN), N_MAX);
}

/** The button that starts the computation and, while it runs, cancels it (docs/DESIGN.md §5). */
function ComputeButton({
  running,
  onClick,
}: {
  running: boolean;
  onClick: () => void;
}): JSX.Element {
  const t = useT();
  return (
    <button
      type="button"
      className={`${BUTTON_BASE} bg-primary text-primary-fg border-primary font-semibold`}
      data-testid="workspace-compute"
      onClick={onClick}
    >
      {t(running ? 'sims.workspace.cancel' : 'sims.workspace.compute')}
    </button>
  );
}

/** The visibility toggle of the cloud; disabled while there is none. */
function VisibilityButton({
  visible,
  hasPoints,
  onClick,
}: {
  visible: boolean;
  hasPoints: boolean;
  onClick: () => void;
}): JSX.Element {
  const t = useT();
  return (
    <button
      type="button"
      className={
        visible
          ? `${BUTTON_BASE} bg-primary text-primary-fg border-primary`
          : `${BUTTON_BASE} border-border bg-bg-raised text-fg-muted`
      }
      aria-pressed={visible}
      disabled={!hasPoints}
      data-testid="workspace-visibility"
      onClick={onClick}
    >
      {t(visible ? 'sims.workspace.hide' : 'sims.workspace.show')}
    </button>
  );
}

/** The live line of the panel and, while computing, the progress bar. */
function PanelStatus({
  running,
  progress,
  points,
}: {
  running: boolean;
  progress: number;
  points: Float32Array | null;
}): JSX.Element {
  const t = useT();
  return (
    <>
      {running ? <ProgressBar progress={progress} label={t('sims.workspace.progress')} /> : null}
      <p className="text-fg-muted text-xs" aria-live="polite" data-testid="workspace-status">
        {statusText(running, progress, points, t)}
      </p>
    </>
  );
}

/** The live line of the panel: not computed, computing with its figure, or the cloud ready. */
function statusText(
  running: boolean,
  progress: number,
  points: Float32Array | null,
  t: ReturnType<typeof useT>,
): string {
  if (running) return t('sims.workspace.computing', { percent: String(percent(progress)) });
  if (points === null) return t('sims.workspace.empty');
  return t('sims.workspace.ready', { count: String(points.length / 3) });
}

/**
 * «Espacio de trabajo» panel of the arm viewer: how many configurations to sample, the button
 * that starts or cancels the computation, the progress and the visibility toggle of the cloud.
 */
export function WorkspacePanel({ arm, onChange, schedule }: WorkspacePanelProps): JSX.Element {
  const t = useT();
  const [count, setCount] = useState(N_DEFAULT);
  const [points, setPoints] = useState<Float32Array | null>(null);
  const [visible, setVisible] = useState(true);

  const onPoints = useCallback(
    (result: Float32Array): void => {
      setPoints(result);
      setVisible(true);
      onChange({ points: result, visible: true });
    },
    [onChange],
  );
  const { running, progress, start, cancel } = useSampling(arm, schedule, onPoints);

  const onCompute = (): void => {
    if (running) return cancel();
    const clamped = clampCount(count);
    setCount(clamped);
    start(clamped);
  };
  const onVisible = (): void => {
    setVisible(!visible);
    onChange({ points, visible: !visible });
  };

  return (
    <section aria-label={t('sims.workspace.title')} data-testid="workspace-panel">
      <PanelCard title={t('sims.workspace.title')} testId="workspace-card" gapClass="gap-3">
        <CountField value={count} disabled={running} onChange={setCount} />
        <div className="flex flex-wrap items-center gap-2">
          <ComputeButton running={running} onClick={onCompute} />
          <VisibilityButton visible={visible} hasPoints={points !== null} onClick={onVisible} />
        </div>
        <PanelStatus running={running} progress={progress} points={points} />
      </PanelCard>
    </section>
  );
}
