import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { RobotSpec } from '@trayectoria/robot-spec';
import type { Mat4 } from '@trayectoria/sim-core';
import { Frame, Scene3D } from '@trayectoria/widgets/scene3d';
import type { URDFRobot } from 'urdf-loader';

import { EffectorPanel } from './EffectorPanel';
import { FramesToggle } from './FramesToggle';
import { JointSliders } from './JointSliders';
import { UrdfModel } from './UrdfModel';
import { readArmColors } from './armColors';
import { loadUrdf } from './loadUrdf';
import { useArmSim } from './useArmSim';
import type { ArmSim } from './useArmSim';

// F5-01a (#133): visor URDF con las props de `ArmViewerWidget` (docs/WIDGETS.md). `show` acepta
// las tres opciones del catálogo, pero solo `'frames'` es operativo en este ticket; las matrices
// son F5-02 y el espacio de trabajo F5-03.

/** Largo de los brazos de cada tríada de eslabón, en metros. */
const FRAME_LENGTH_M = 0.06;

/** UUID que recibe el `RobotSpec` de un brazo del catálogo; el visor no persiste robots. */
const VIEWER_ROBOT_ID = '00000000-0000-4000-8000-000000000133';

/** Posición del eslabón, en metros, leída de la columna de traslación del `Mat4` de sim-core. */
export function translationOf(transform: Mat4): readonly [number, number, number] {
  // Columna-mayor (sim-core math/mat4.ts): la traslación ocupa los índices 12, 13 y 14.
  return [transform[12] ?? 0, transform[13] ?? 0, transform[14] ?? 0];
}

export interface ArmViewerProps {
  /** Brazo del catálogo a cargar (`catalog/arms/{catalogId}`). */
  catalogId?: string;
  /** Brazo ya resuelto; tiene prioridad sobre `catalogId` para el spec. */
  robot?: RobotSpec;
  /** Configuración inicial, en radianes. */
  initialQ?: number[];
  /** Qué capas se muestran; en este ticket solo `'frames'` es operativa. */
  show: Array<'frames' | 'matrices' | 'workspace'>;
  compact?: boolean;
}

/** El brazo cargado del catálogo, o `null` mientras se carga o si falla. */
function useCatalogArm(catalogId: string | undefined): {
  robot: URDFRobot | null;
  spec: RobotSpec | null;
  failed: boolean;
} {
  const [state, setState] = useState<{
    robot: URDFRobot | null;
    spec: RobotSpec | null;
    failed: boolean;
  }>({ robot: null, spec: null, failed: false });

  useEffect(() => {
    if (catalogId === undefined) return;
    let active = true;
    loadUrdf(catalogId, { domParser: new DOMParser(), robotId: VIEWER_ROBOT_ID })
      .then((loaded) => {
        if (active) setState({ robot: loaded.robot, spec: loaded.spec, failed: false });
      })
      .catch(() => {
        if (active) setState({ robot: null, spec: null, failed: true });
      });
    return () => {
      active = false;
    };
  }, [catalogId]);

  return state;
}

/** Las tríadas de los eslabones, colocadas con `forwardKinematics` de sim-core (nunca con three). */
function LinkFrames({ transforms }: { transforms: ReadonlyMap<string, Mat4> }): JSX.Element {
  return (
    <>
      {[...transforms].map(([link, transform]) => (
        <Frame key={link} position_m={translationOf(transform)} length_m={FRAME_LENGTH_M} />
      ))}
    </>
  );
}

/** La escena del visor: el brazo de three y, si están activos, los marcos de los eslabones. */
function ArmScene({
  spec,
  sim,
  robot,
  framesVisible,
}: {
  spec: RobotSpec;
  sim: ArmSim;
  robot: URDFRobot | null;
  framesVisible: boolean;
}): JSX.Element {
  const t = useT();
  const colors = useMemo(
    () => readArmColors(typeof document === 'undefined' ? null : document.documentElement),
    [],
  );
  return (
    <Scene3D description={t('sims.arm.scene', { name: spec.name })}>
      {robot === null ? null : (
        <UrdfModel
          robot={robot}
          joints={sim.joints}
          q_rad={sim.q_rad}
          baseLink={sim.arm.baseLink}
          colors={colors}
        />
      )}
      {framesVisible ? <LinkFrames transforms={sim.linkTransforms} /> : null}
    </Scene3D>
  );
}

/** El visor con un brazo ya resuelto: escena, sliders y panel del efector. */
function ArmViewerReady({
  spec,
  robot,
  initialQ,
  showFrames,
  compact,
}: {
  spec: RobotSpec;
  robot: URDFRobot | null;
  initialQ: number[] | undefined;
  showFrames: boolean;
  compact: boolean;
}): JSX.Element {
  const sim = useArmSim(spec, initialQ);
  const [framesVisible, setFramesVisible] = useState(showFrames);
  return (
    <div
      className={compact ? 'flex flex-col gap-4' : 'flex flex-col gap-5 md:flex-row'}
      data-testid="arm-viewer"
      data-compact={String(compact)}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-3">
          <FramesToggle visible={framesVisible} onToggle={setFramesVisible} />
        </div>
        <ArmScene spec={spec} sim={sim} robot={robot} framesVisible={framesVisible} />
      </div>
      <div className="flex min-w-0 flex-col gap-5 md:w-72">
        <JointSliders joints={sim.joints} q_rad={sim.q_rad} onChange={sim.setJoint} />
        <EffectorPanel readout={sim.readout} />
      </div>
    </div>
  );
}

/**
 * Visor URDF de un brazo serial (docs/WIDGETS.md, ArmViewerWidget). La escena viene de
 * `urdf-loader`; los marcos, los límites y el panel del efector, de sim-core.
 */
export function ArmViewer({
  catalogId,
  robot,
  initialQ,
  show,
  compact = false,
}: ArmViewerProps): JSX.Element {
  const t = useT();
  // `catalogId` siempre se carga si viene: es de donde salen la jerarquía y las mallas. `robot`,
  // si se pasa, manda sobre el spec (docs/WIDGETS.md, ArmViewerWidget).
  const loaded = useCatalogArm(catalogId);
  const spec = robot ?? loaded.spec;

  if (spec === null) {
    return (
      <p className="text-fg-muted text-sm" role="status" data-testid="arm-viewer-status">
        {loaded.failed ? t('sims.arm.loadError', { id: catalogId ?? '' }) : t('sims.arm.loading')}
      </p>
    );
  }

  return (
    <ArmViewerReady
      spec={spec}
      robot={loaded.robot}
      initialQ={initialQ}
      showFrames={show.includes('frames')}
      compact={compact}
    />
  );
}
