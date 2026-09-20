import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { radToDeg } from '@trayectoria/sim-core';
import type { Mat4 } from '@trayectoria/sim-core';
import { Frame, Scene3D } from '@trayectoria/widgets/scene3d';
import type { URDFRobot } from 'urdf-loader';

import { EffectorPanel } from './EffectorPanel';
import { FramesToggle } from './FramesToggle';
import { JointSliders } from './JointSliders';
import { MatrixPanel } from './MatrixPanel';
import { UrdfModel } from './UrdfModel';
import { readArmColors } from './armColors';
import { loadUrdf } from './loadUrdf';
import { linkTransforms } from './matrices';
import { useArmSim } from './useArmSim';
import type { ActuatedJoint, ArmSim, EffectorReadout } from './useArmSim';

// F5-01a (#133): visor URDF con las props de `ArmViewerWidget` (docs/WIDGETS.md). `show` acepta
// las tres opciones del catálogo; `'frames'` es de F5-01a y `'matrices'` de F5-02 (#135,
// decisiones 4 y 5). El espacio de trabajo sigue siendo F5-03.

/** Largo de los brazos de cada tríada de eslabón, en metros. */
const FRAME_LENGTH_M = 0.06;

/** UUID que recibe el `RobotSpec` de un brazo del catálogo; el visor no persiste robots. */
const VIEWER_ROBOT_ID = '00000000-0000-4000-8000-000000000133';

/** Posición del eslabón, en metros, leída de la columna de traslación del `Mat4` de sim-core. */
export function translationOf(transform: Mat4): readonly [number, number, number] {
  // Columna-mayor (sim-core math/mat4.ts): la traslación ocupa los índices 12, 13 y 14.
  return [transform[12] ?? 0, transform[13] ?? 0, transform[14] ?? 0];
}

/** Uno de los paneles laterales del visor, listo para envolverlo desde fuera. */
export interface ArmViewerPanel {
  /** Cuál de los paneles es; `'matrices'` solo aparece con `show: ['matrices']` (F5-02). */
  readonly id: 'joints' | 'effector' | 'matrices';
  /** Título del panel, ya traducido. */
  readonly title: string;
  /** Resumen de una línea, legible con el panel plegado (por ejemplo `x 0.000 y 0.350 z 0.000 m`). */
  readonly summary: string;
  /** El panel tal cual lo pinta el visor. */
  readonly content: ReactNode;
}

/** Decimales del resumen de las articulaciones, en grados (mismo formato que el panel del efector). */
const JOINT_SUMMARY_DECIMALS = 1;

/** Resumen de una línea de las articulaciones: `joint1 90.0° · joint2 0.0°`. */
export function jointsSummary(
  joints: readonly ActuatedJoint[],
  q_rad: readonly number[],
  unit_deg: string,
): string {
  return joints
    .map(
      (joint, index) =>
        `${joint.name} ${radToDeg(q_rad[index] ?? 0).toFixed(JOINT_SUMMARY_DECIMALS)}${unit_deg}`,
    )
    .join(' · ');
}

/** Resumen de una línea del efector: `x 0.000 y 0.350 z 0.000 m`. */
export function effectorPanelSummary(readout: EffectorReadout, t: Translate): string {
  const axes = [
    [t('sims.arm.x'), readout.x_m],
    [t('sims.arm.y'), readout.y_m],
    [t('sims.arm.z'), readout.z_m],
  ]
    .map(([label, value]) => `${label} ${value}`)
    .join(' ');
  return `${axes} ${t('sims.arm.unitM')}`;
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
  /**
   * Envoltorio opcional de los paneles «Articulaciones» y «Efector» (F5-01b, #134). El visor
   * llama a esta función una vez por panel, en ese orden, y pinta lo que devuelve en lugar del
   * panel suelto. Sirve para que la página los pliegue en acordeones en móvil (docs/DESIGN.md
   * §9.4) sin duplicar su contenido. Sin ella el marcado es exactamente el de F5-01a.
   */
  renderPanel?: (panel: ArmViewerPanel) => ReactNode;
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
  highlightLink,
}: {
  spec: RobotSpec;
  sim: ArmSim;
  robot: URDFRobot | null;
  framesVisible: boolean;
  highlightLink: string | undefined;
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
          highlightLink={highlightLink}
        />
      )}
      {framesVisible ? <LinkFrames transforms={sim.linkTransforms} /> : null}
    </Scene3D>
  );
}

/** Resumen de una línea del panel de matrices: qué eslabón se está mirando. */
export function matricesSummary(link: string | null, t: Translate): string {
  return link ?? t('sims.matrices.baseLink');
}

/** Los paneles laterales del visor, en el orden en que se muestran. */
function armPanels(
  sim: ArmSim,
  t: Translate,
  matrices: { readonly show: boolean; readonly onHighlight: (link: string | null) => void; readonly highlighted: string | null },
): readonly ArmViewerPanel[] {
  const panels: ArmViewerPanel[] = [
    {
      id: 'joints',
      title: t('sims.arm.joints'),
      summary: jointsSummary(sim.joints, sim.q_rad, t('sims.arm.unitDeg')),
      content: <JointSliders joints={sim.joints} q_rad={sim.q_rad} onChange={sim.setJoint} />,
    },
    {
      id: 'effector',
      title: t('sims.arm.effector'),
      summary: effectorPanelSummary(sim.readout, t),
      content: <EffectorPanel readout={sim.readout} />,
    },
  ];
  // El panel de matrices solo existe con `show: ['matrices']` (#135, decisión 5); va como un
  // panel más para que la página lo pliegue en móvil con el mismo `renderPanel`.
  if (matrices.show) {
    panels.push({
      id: 'matrices',
      title: t('sims.matrices.title'),
      summary: matricesSummary(matrices.highlighted, t),
      content: (
        <MatrixPanel
          rows={linkTransforms(sim.arm, sim.q_rad)}
          onHighlightLink={matrices.onHighlight}
        />
      ),
    });
  }
  return panels;
}

/** La columna de paneles, envuelta por el consumidor si pasó `renderPanel`. */
function PanelColumn({
  panels,
  renderPanel,
}: {
  panels: readonly ArmViewerPanel[];
  renderPanel: ((panel: ArmViewerPanel) => ReactNode) | undefined;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-5 md:w-72">
      {panels.map((panel) => (
        <Fragment key={panel.id}>
          {renderPanel === undefined ? panel.content : renderPanel(panel)}
        </Fragment>
      ))}
    </div>
  );
}

/** Lo que `ArmViewerReady` necesita, ya resuelto por `ArmViewer`. */
interface ArmViewerReadyProps {
  spec: RobotSpec;
  robot: URDFRobot | null;
  initialQ: number[] | undefined;
  showFrames: boolean;
  showMatrices: boolean;
  compact: boolean;
  renderPanel: ((panel: ArmViewerPanel) => ReactNode) | undefined;
}

/** El visor con un brazo ya resuelto: escena, sliders y panel del efector. */
function ArmViewerReady({
  spec,
  robot,
  initialQ,
  showFrames,
  showMatrices,
  compact,
  renderPanel,
}: ArmViewerReadyProps): JSX.Element {
  const t = useT();
  const sim = useArmSim(spec, initialQ);
  const [framesVisible, setFramesVisible] = useState(showFrames);
  // El eslabón elegido en el panel de matrices, que es el que se marca en 3D (#135, decisión 4).
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const onHighlight = useCallback((link: string | null): void => {
    setHighlighted(link);
  }, []);
  const panels = armPanels(sim, t, { show: showMatrices, onHighlight, highlighted });
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
        <ArmScene
          spec={spec}
          sim={sim}
          robot={robot}
          framesVisible={framesVisible}
          highlightLink={showMatrices ? (highlighted ?? undefined) : undefined}
        />
      </div>
      <PanelColumn panels={panels} renderPanel={renderPanel} />
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
  renderPanel,
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
      showMatrices={show.includes('matrices')}
      compact={compact}
      renderPanel={renderPanel}
    />
  );
}
