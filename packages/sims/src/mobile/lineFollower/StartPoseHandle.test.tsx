import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { t } from '@trayectoria/i18n';
import { pointAt, presets } from '@trayectoria/sim-core';

import { StartPoseHandle, StartPoseMarker, TANGENT_STEP_M, poseOnTrack } from './StartPoseHandle';
import { buildTrackIndex, projectOnTrack } from './lap';

/** Pista de los valores dorados del ticket (#128). */
const TRACK = presets.oval;

describe('poseOnTrack (F4-02b)', () => {
  it('proyecta (0.3, 0.9) al punto más cercano del óvalo con el rumbo de la tangente', () => {
    const index = buildTrackIndex(TRACK);
    const pose = poseOnTrack(TRACK, [0.3, 0.9]);

    // Valor dorado del ticket: el mismo `s` que da `projectOnTrack`, y el rumbo tomado con
    // `pointAt(s)` y `pointAt(s + 1e-3)` con tolerancia 1e-6.
    const s_m = projectOnTrack(index, [0.3, 0.9]);
    const here = pointAt(TRACK, s_m);
    const ahead = pointAt(TRACK, s_m + TANGENT_STEP_M);
    expect(pose.s_m).toBeCloseTo(s_m, 12);
    expect(pose.x_m).toBeCloseTo(here[0], 12);
    expect(pose.y_m).toBeCloseTo(here[1], 12);
    expect(pose.theta_rad).toBeCloseTo(Math.atan2(ahead[1] - here[1], ahead[0] - here[0]), 6);
  });

  it('es idempotente: proyectar un punto ya sobre la pista lo deja donde está', () => {
    const on = pointAt(TRACK, 0.4);
    const pose = poseOnTrack(TRACK, [on[0], on[1]]);
    expect(pose.x_m).toBeCloseTo(on[0], 2);
    expect(pose.y_m).toBeCloseTo(on[1], 2);
  });

  it('acepta una longitud de arco directa, que es la ruta de teclado del campo `s_m`', () => {
    const pose = poseOnTrack(TRACK, null, 0.25);
    const here = pointAt(TRACK, 0.25);
    expect(pose.s_m).toBeCloseTo(0.25, 12);
    expect(pose.x_m).toBeCloseTo(here[0], 12);
    expect(pose.y_m).toBeCloseTo(here[1], 12);
  });

  it('envuelve una longitud de arco fuera del recorrido en lugar de salirse de la pista', () => {
    const pose = poseOnTrack(TRACK, null, -0.1);
    expect(pose.s_m).toBeGreaterThanOrEqual(0);
  });
});

describe('StartPoseHandle (F4-02b)', () => {
  const VIEW = { worldWidth_m: 1.3, center_m: [0.3, 0.25] as const };

  it('publica la pose proyectada al editar `s_m` con el teclado', () => {
    const onChange = vi.fn();
    render(
      <StartPoseHandle
        track={TRACK}
        pose={poseOnTrack(TRACK, null, 0)}
        onStartPoseChange={onChange}
        view={VIEW}
      >
        {(pose) => <StartPoseMarker pose={pose} />}
      </StartPoseHandle>,
    );

    // El campo es controlado por la página; el test escribe el valor final de una vez, que es
    // lo que el padre ve al confirmarlo.
    const field = screen.getByTestId('start-pose-s');
    expect(field).toHaveValue(0);
    fireEvent.change(field, { target: { value: '0.25' } });

    const last = onChange.mock.calls.at(-1)?.[0] as ReturnType<typeof poseOnTrack>;
    expect(last.s_m).toBeCloseTo(0.25, 12);
    const here = pointAt(TRACK, 0.25);
    expect(last.x_m).toBeCloseTo(here[0], 12);
  });

  it('anuncia el asa como grupo con nombre accesible', () => {
    render(
      <StartPoseHandle
        track={TRACK}
        pose={poseOnTrack(TRACK, null, 0)}
        onStartPoseChange={vi.fn()}
        view={VIEW}
      >
        {(pose) => <StartPoseMarker pose={pose} />}
      </StartPoseHandle>,
    );
    expect(screen.getByTestId('start-pose-handle')).toHaveAccessibleName();
  });
});

describe('StartPoseHandle · arrastre sobre la pista (F4-02b)', () => {
  // jsdom da caja cero a todo, así que se le fija una al lienzo: 720 × 405 px sobre el encuadre
  // del óvalo (`viewOf`), que es el que el visor pasa al asa. El mapeo es el mismo
  // `createTransform` que pinta la escena, así que píxeles y metros coinciden por construcción.
  const VIEW = { worldWidth_m: 1.3, center_m: [0.3, 0.25] as const };
  const BOX = { x: 0, y: 0, top: 0, left: 0, right: 720, bottom: 405, width: 720, height: 405 };
  const PX_PER_M = BOX.width / VIEW.worldWidth_m;

  /** Píxeles del lienzo del punto `p_m`, con el mapeo del asa. */
  function px(p_m: readonly [number, number]): { clientX: number; clientY: number } {
    return {
      clientX: BOX.width / 2 + (p_m[0] - VIEW.center_m[0]) * PX_PER_M,
      clientY: BOX.height / 2 - (p_m[1] - VIEW.center_m[1]) * PX_PER_M,
    };
  }

  /** Da caja al lienzo y devuelve el contenedor al que llegan los eventos de puntero. */
  function layOutCanvas(): HTMLElement {
    const canvas = screen.getByRole('img', { name: t('sims.lineFollower.scene') });
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ ...BOX, toJSON: () => BOX });
    const host = screen.getByTestId('start-pose-handle');
    host.setPointerCapture = () => undefined;
    host.releasePointerCapture = () => undefined;
    return host;
  }

  it('soltar en (0.3, 0.9) publica la proyección con el rumbo de la tangente', () => {
    const onChange = vi.fn();
    render(
      <StartPoseHandle
        track={TRACK}
        pose={poseOnTrack(TRACK, null, 0)}
        onStartPoseChange={onChange}
        view={VIEW}
      >
        {(pose) => (
          <div>
            <StartPoseMarker pose={pose} />
            <canvas role="img" aria-label={t('sims.lineFollower.scene')} />
          </div>
        )}
      </StartPoseHandle>,
    );
    const host = layOutCanvas();

    fireEvent.pointerDown(host, { pointerId: 1, ...px([0.3, 0.6]) });
    fireEvent.pointerMove(host, { pointerId: 1, ...px([0.3, 0.75]) });
    fireEvent.pointerUp(host, { pointerId: 1, ...px([0.3, 0.9]) });

    // Valor dorado de #128: el mismo `s` que `projectOnTrack` y el rumbo de `pointAt(s + 1e-3)`.
    const expected = poseOnTrack(TRACK, [0.3, 0.9]);
    const last = onChange.mock.calls.at(-1)?.[0] as typeof expected;
    expect(last.s_m).toBeCloseTo(expected.s_m, 12);
    expect(last.x_m).toBeCloseTo(expected.x_m, 12);
    expect(last.y_m).toBeCloseTo(expected.y_m, 12);
    const here = pointAt(TRACK, last.s_m);
    const ahead = pointAt(TRACK, last.s_m + TANGENT_STEP_M);
    expect(last.theta_rad).toBeCloseTo(Math.atan2(ahead[1] - here[1], ahead[0] - here[0]), 6);
  });

  it('un movimiento sin arrastre previo no publica nada', () => {
    const onChange = vi.fn();
    render(
      <StartPoseHandle
        track={TRACK}
        pose={poseOnTrack(TRACK, null, 0)}
        onStartPoseChange={onChange}
        view={VIEW}
      >
        {(pose) => (
          <div>
            <StartPoseMarker pose={pose} />
            <canvas role="img" aria-label={t('sims.lineFollower.scene')} />
          </div>
        )}
      </StartPoseHandle>,
    );
    const host = layOutCanvas();

    fireEvent.pointerMove(host, { pointerId: 1, ...px([0.3, 0.9]) });
    fireEvent.pointerUp(host, { pointerId: 1, ...px([0.3, 0.9]) });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('sin lienzo medido el arrastre no publica una pose inventada', () => {
    const onChange = vi.fn();
    render(
      <StartPoseHandle
        track={TRACK}
        pose={poseOnTrack(TRACK, null, 0)}
        onStartPoseChange={onChange}
        view={VIEW}
      >
        {(pose) => <StartPoseMarker pose={pose} />}
      </StartPoseHandle>,
    );
    const host = screen.getByTestId('start-pose-handle');
    host.setPointerCapture = () => undefined;

    // Sin `<canvas>` dentro del asa, `worldOf` devuelve null y el arrastre no arranca.
    fireEvent.pointerDown(host, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(host, { pointerId: 1, clientX: 10, clientY: 10 });

    expect(onChange).not.toHaveBeenCalled();
  });
});
