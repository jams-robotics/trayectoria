import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { ArmSpec } from '@trayectoria/robot-spec';

import { PanelCard } from '../PanelCard';
import { CANCELLED_REASON, WORKSPACE_SEED, sampleWorkspaceInBatches } from './sampler';
import type { BatchSchedule } from './sampler';

// F5-03 (#136, decisión 4): panel «Espacio de trabajo». Campo numérico con `n`, botón que pasa
// de Calcular a Cancelar mientras el muestreo corre, barra de progreso de 4 px con la cifra
// (docs/DESIGN.md §5) y toggle `aria-pressed` de visibilidad. Ningún literal en español vive
// aquí: todo sale de las claves `sims.workspace.*`.

/** Límites del campo numérico `n` (espec. del ticket). */
export const N_DEFAULT = 20_000;
export const N_MIN = 100;
export const N_MAX = 200_000;
export const N_STEP = 1_000;

/** Botón de 40 px de alto del panel (docs/DESIGN.md §5, Botón). */
const BUTTON_BASE = 'h-10 rounded-sm border px-3 text-sm';

/** Porcentaje entero de una fracción `[0, 1]`, para la cifra que acompaña a la barra. */
function percent(progress: number): number {
  return Math.round(progress * 100);
}

/** Estado del muestreo que el panel expone hacia fuera. */
export interface WorkspaceState {
  /** La nube ya calculada, o `null` si aún no se ha calculado ninguna. */
  readonly points: Float32Array | null;
  /** Si la nube se dibuja. */
  readonly visible: boolean;
}

export interface WorkspacePanelProps {
  /** El brazo a muestrear; sus límites articulares definen el espacio alcanzable. */
  arm: ArmSpec;
  /** Avisa de la nube y de su visibilidad cada vez que cambian. */
  onChange: (state: WorkspaceState) => void;
  /** Planificador de lotes; los tests inyectan uno síncrono (decisión 2). */
  schedule?: BatchSchedule;
}

/** Lo que el panel necesita saber del muestreo en marcha. */
interface Sampling {
  readonly running: boolean;
  readonly progress: number;
  start: (n: number) => void;
  cancel: () => void;
}

/** El muestreo por lotes atado al ciclo de vida del panel: progreso, cancelación y limpieza. */
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

  // Al desmontar, un muestreo a medias se queda sin quien lo consuma: se aborta.
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
          // Cancelar es una salida normal del muestreo, no un fallo que reportar.
          if (error instanceof Error && error.message === CANCELLED_REASON) return;
          cancelRef.current = null;
          setRunning(false);
        });
    },
    [arm, onPoints, schedule],
  );

  return { running, progress, start, cancel };
}

/** La barra de 4 px con su cifra en mono (docs/DESIGN.md §5, Barra de progreso). */
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

/** El campo numérico de `n` (docs/DESIGN.md §5, Campo numérico). */
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

/** `n` recortado a los límites del campo; un valor no numérico vuelve al de por defecto. */
export function clampCount(value: number): number {
  if (!Number.isFinite(value)) return N_DEFAULT;
  return Math.min(Math.max(Math.round(value), N_MIN), N_MAX);
}

/** El botón que lanza el cálculo y, mientras corre, lo cancela (docs/DESIGN.md §5). */
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

/** El toggle de visibilidad de la nube; deshabilitado mientras no haya ninguna. */
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

/** La línea viva del panel y, mientras calcula, la barra de progreso. */
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

/** La línea viva del panel: sin calcular, calculando con su cifra, o la nube ya lista. */
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
 * Panel «Espacio de trabajo» del visor del brazo: cuántas configuraciones muestrear, el botón
 * que lanza o cancela el cálculo, el progreso y el toggle de visibilidad de la nube.
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
