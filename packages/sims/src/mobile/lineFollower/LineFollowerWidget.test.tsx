import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { REFERENCE_PID_PARAMS, presets, serializeTrack } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { LineFollowerWidget, resolveTrack } from './LineFollowerWidget';
import { viewOf } from './LineFollowerView';

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
    // El óvalo abarca x ∈ [-0.25, 0.85]: 1.1 m más 0.1 m de margen a cada lado.
    expect(wide.worldWidth_m).toBeCloseTo(1.3, 3);
    expect(wide.center_m[0]).toBeCloseTo(0.3, 3);
    const tiny = viewOf({ segments: [{ type: 'line', from: [0, 0], to: [0.1, 0] }], lineWidth_m: 0.02 }, true);
    expect(tiny.worldWidth_m).toBe(1);
    const empty = viewOf({ segments: [], lineWidth_m: 0.02 }, false);
    expect(empty.center_m).toEqual([0, 0]);
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
    // El robot arranca al inicio de la pista, pero su arreglo va 0.09 m por delante
    // (docs/ROBOT-SPEC.md §3): sobre una pista de 2 cm los sensores quedan fuera de ella.
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
