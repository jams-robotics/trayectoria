import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  REFERENCE_PID_PARAMS,
  pointAt,
  presets,
  serializeTrack,
  trackLength_m,
} from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { LineFollowerWidget } from './LineFollowerWidget';
import { resolveTrack } from './tracks';
import { SCALE_BAND_FRACTION, viewOf } from './LineFollowerView';

const ROBOT = referenceMobile as RobotSpec;
const PARAMS = { ...REFERENCE_PID_PARAMS };

describe('LineFollowerWidget (F4-02a)', () => {
  it('resuelve los presets, el JSON serializado y un Track ya construido', () => {
    expect(resolveTrack('oval')).toBe(presets.oval);
    expect(resolveTrack('s')).toBe(presets.sCurve);
    expect(resolveTrack('tight')).toBe(presets.tightCurves);
    expect(resolveTrack('cross')).toBe(presets.crossing);
    expect(resolveTrack(presets.oval)).toBe(presets.oval);
    expect(resolveTrack(serializeTrack(presets.sCurve)).segments).toHaveLength(
      presets.sCurve.segments.length,
    );
  });

  it('cae en el óvalo cuando el JSON no es una pista válida', () => {
    expect(resolveTrack('{')).toBe(presets.oval);
  });

  it('encuadra la pista con margen y respeta el ancho mínimo en compacto', () => {
    const wide = viewOf(presets.oval, false);
    // The oval spans x ∈ [-0.25, 0.85] and y ∈ [0, 0.5]: with margin, 1.3 m wide versus the
    // 0.7 / 0.84 · 16/9 = 1.481 m its height asks for once the scale band is kept clear (#536).
    expect(wide.worldWidth_m).toBeCloseTo(1.4815, 3);
    expect(wide.center_m[0]).toBeCloseTo(0.3, 3);
    // The view drops by half the band: 0.25 − (1.4815 / (16/9) · 0.16) / 2 = 0.1833 m.
    expect(wide.center_m[1]).toBeCloseTo(0.1833, 3);
    const tiny = viewOf({ segments: [{ type: 'line', from: [0, 0], to: [0.1, 0] }], lineWidth_m: 0.02 }, true);
    expect(tiny.worldWidth_m).toBe(1);
    const empty = viewOf({ segments: [], lineWidth_m: 0.02 }, false);
    // Centred on the origin, lowered by half the scale band like any other track (#536).
    expect(empty.center_m[0]).toBe(0);
    expect(empty.center_m[1]).toBeCloseTo(-0.019, 3);
  });

  it('ensancha la vista cuando la pista es más alta que ancha (#157)', () => {
    // The crossing spans x ∈ [-0.2, 0.6] and y ∈ [-0.4, 0.4]: 1 m wide with margin, but its height
    // of 1 m asks for 1 / 0.84 · 16/9 = 2.116 m so that the whole track fits above the scale band.
    expect(viewOf(presets.crossing, false).worldWidth_m).toBeCloseTo(2.1164, 3);
    // The S spans x ∈ [-0.2, 1.2] and y ∈ [-0.4, 0.4]: 1.6 m wide, 2.116 m because of the height.
    expect(viewOf(presets.sCurve, false).worldWidth_m).toBeCloseTo(2.1164, 3);
    // The tight curves span x ∈ [-0.15, 0.35] and y ∈ [0, 0.5]: 0.7 m wide, 1.481 m
    // because of the height; in compact mode the 1 m minimum no longer wins.
    expect(viewOf(presets.tightCurves, false).worldWidth_m).toBeCloseTo(1.4815, 3);
    expect(viewOf(presets.tightCurves, true).worldWidth_m).toBeCloseTo(1.4815, 3);
  });

  it('deja libre la franja inferior de la escala en los presets (#536)', () => {
    const aspect = 16 / 9;
    for (const track of Object.values(presets)) {
      for (const compact of [false, true]) {
        const view = viewOf(track, compact);
        const height_m = view.worldWidth_m / aspect;
        const bandTop_m = view.center_m[1] - height_m / 2 + height_m * SCALE_BAND_FRACTION;
        const count = Math.ceil(trackLength_m(track) / 0.01);
        for (let k = 0; k < count; k += 1) {
          // The margin of 0.1 m around the centerline is what holds the robot sitting on it.
          expect(pointAt(track, k * 0.01)[1] - 0.1).toBeGreaterThanOrEqual(bandTop_m - 1e-9);
        }
      }
    }
  });

  it('deja toda la línea central dentro del visor en los presets y en una pista alta (#157)', () => {
    const aspect = 16 / 9;
    const tall: Track = {
      segments: [
        { type: 'line', from: [0, -0.9], to: [0.1, 0.4] },
        {
          type: 'arc',
          center: [0.25, 0.4],
          radius_m: 0.15,
          startAngle_rad: Math.PI,
          endAngle_rad: 0,
          ccw: false,
        },
        { type: 'line', from: [0.4, 0.4], to: [0.2, -0.9] },
      ],
      lineWidth_m: 0.02,
    };
    const tracks: readonly Track[] = [...Object.values(presets), tall];
    for (const track of tracks) {
      for (const compact of [false, true]) {
        const view = viewOf(track, compact);
        const halfWidth_m = view.worldWidth_m / 2;
        const halfHeight_m = view.worldWidth_m / aspect / 2;
        const count = Math.ceil(trackLength_m(track) / 0.01);
        for (let k = 0; k < count; k += 1) {
          const [x_m, y_m] = pointAt(track, k * 0.01);
          expect(Math.abs(x_m - view.center_m[0])).toBeLessThanOrEqual(halfWidth_m);
          expect(Math.abs(y_m - view.center_m[1])).toBeLessThanOrEqual(halfHeight_m);
        }
      }
    }
  });

  it('muestra el visor, los controles, la leyenda y las lecturas', () => {
    render(
      <LineFollowerWidget track="oval" controller="pid" initialParams={PARAMS} robot={ROBOT} />,
    );
    expect(screen.getByTestId('line-follower-view')).toBeInTheDocument();
    expect(screen.getByTestId('line-follower-legend')).toBeInTheDocument();
    expect(screen.getByTestId('line-follower-readouts')).toBeInTheDocument();
    expect(screen.getByTestId('line-follower-laps')).toHaveTextContent('0');
    expect(screen.getByTestId('line-follower-t')).toHaveTextContent('0.00 s');
  });

  it('oculta el panel de controlador y la leyenda en compacto', () => {
    render(
      <LineFollowerWidget
        track="s"
        controller="pid"
        initialParams={PARAMS}
        robot={ROBOT}
        compact
      />,
    );
    expect(screen.queryByTestId('line-follower-legend')).not.toBeInTheDocument();
    expect(screen.queryByTestId('line-follower-controller')).not.toBeInTheDocument();
  });

  it('ofrece los cuatro controladores y la pestaña «Propio» deshabilitada', () => {
    render(
      <LineFollowerWidget track="oval" controller="pid" initialParams={PARAMS} robot={ROBOT} />,
    );
    expect(screen.getByRole('button', { name: 'PID' })).toHaveAttribute('aria-pressed', 'true');
    for (const label of ['Manual', 'On/off', 'P']) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false');
    }
    const custom = screen.getByTestId('line-follower-custom');
    expect(custom).toBeDisabled();
    expect(custom).toHaveAttribute('aria-disabled', 'true');
    expect(custom).toHaveTextContent('v2');
  });

  it('cambia de controlador y vuelve a sus parámetros por defecto', async () => {
    const user = userEvent.setup();
    render(
      <LineFollowerWidget track="oval" controller="pid" initialParams={PARAMS} robot={ROBOT} />,
    );
    expect(screen.getByRole(`slider`, { name: /Kp/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Manual' }));
    expect(screen.getByRole('button', { name: 'Manual' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole(`slider`, { name: /Kp/ })).not.toBeInTheDocument();
    expect(screen.getByRole(`slider`, { name: /Velocidad base/ })).toBeInTheDocument();
  });

  it('avanza un paso del modelo con el botón Paso', async () => {
    const user = userEvent.setup();
    render(
      <LineFollowerWidget track="oval" controller="pid" initialParams={PARAMS} robot={ROBOT} />,
    );
    await user.click(screen.getByRole('button', { name: 'Paso' }));
    expect(screen.getByTestId('line-follower-t')).toHaveTextContent('0.00 s');
    expect(screen.getByTestId('line-follower-v')).not.toHaveTextContent('0.000 m/s');
  });

  it('avisa cuando el arreglo pierde la línea', () => {
    // The robot starts at the beginning of the track, but its array is 0.09 m ahead
    // (docs/ROBOT-SPEC.md §3): on a 2 cm track the sensors end up outside it.
    render(
      <LineFollowerWidget
        track={{ segments: [{ type: 'line', from: [0, 0], to: [0.02, 0] }], lineWidth_m: 0.02 }}
        controller="pid"
        initialParams={PARAMS}
        robot={ROBOT}
      />,
    );
    expect(screen.getByTestId('line-follower-lost')).toBeInTheDocument();
  });
});

describe('LineFollowerWidget · renderViewer (#158, enmienda tras auditoría de PR #169)', () => {
  it('sin `renderViewer` el visor se renderiza en su columna de siempre', () => {
    render(
      <LineFollowerWidget track="oval" controller="pid" initialParams={PARAMS} robot={ROBOT} />,
    );
    expect(screen.getByTestId('line-follower-view')).toBeInTheDocument();
    expect(screen.queryByTestId('viewer-wrapper')).toBeNull();
  });

  it('con `renderViewer` la página decide dónde coloca el visor', () => {
    render(
      <LineFollowerWidget
        track="oval"
        controller="pid"
        initialParams={PARAMS}
        robot={ROBOT}
        renderViewer={(viewer) => <div data-testid="viewer-wrapper">{viewer}</div>}
      />,
    );
    const wrapper = screen.getByTestId('viewer-wrapper');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.querySelector('[data-testid="line-follower-view"]')).not.toBeNull();
  });
});
