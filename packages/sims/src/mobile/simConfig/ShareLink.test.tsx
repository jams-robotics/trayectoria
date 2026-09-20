import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { REFERENCE_PID_PARAMS } from '@trayectoria/sim-core';
import type { SimConfig } from '@trayectoria/robot-spec';
import { describe, expect, it, vi } from 'vitest';

import { ShareLink } from './ShareLink';
import { decode } from './codec';

// F4-05 (#131, decisión 6): el campo del enlace y «Copiar enlace».

const CONFIG: SimConfig = {
  id: 'link',
  name: 'Configuración compartida',
  track: { preset: 'oval' },
  controller: 'pid',
  params: { ...REFERENCE_PID_PARAMS },
  seed: 1,
};

/** Una pista sintética cuyo enlace pasa de `MAX_LINK_CHARS` (#182). */
const TOO_LONG: SimConfig = {
  ...CONFIG,
  id: 'link-largo',
  track: JSON.stringify({
    version: 1,
    lineWidth_m: 0.02,
    segments: Array.from({ length: 250 }, (_unused, k) => ({
      type: 'line',
      from: [k * 0.137251, Math.sin(k) * 1.618034],
      to: [(k + 1) * 0.137251, Math.cos(k) * 1.414214],
    })),
  }),
};

describe('ShareLink (F4-05)', () => {
  it('mientras el enlace se codifica el botón está deshabilitado, nunca oculto', () => {
    render(<ShareLink config={CONFIG} origin="https://trayectoria.test" onCopied={vi.fn()} />);
    expect(screen.getByTestId('sim-config-copy')).toBeDisabled();
    expect(screen.getByTestId('sim-config-link')).toHaveValue('');
  });

  it('sin `origin` usa el de la página y el enlace vuelve a la misma configuración', async () => {
    render(<ShareLink config={CONFIG} onCopied={vi.fn()} />);
    const field = screen.getByTestId('sim-config-link');
    await waitFor(() => {
      expect(field).not.toHaveValue('');
    });
    const link = (field as HTMLInputElement).value;
    expect(link.startsWith(`${location.origin}/simuladores/movil?c=`)).toBe(true);
    const decoded = await decode(new URL(link).searchParams.get('c') ?? '');
    expect(decoded).toEqual({ ok: true, value: CONFIG });
  });

  // #182 (decisión 2): la configuración que no cabe en un enlace no deja un enlace roto a la vista.
  it('una configuración que no cabe deja el campo vacío y avisa sin copiar nada', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const onCopied = vi.fn();
    render(
      <ShareLink config={TOO_LONG} origin="https://trayectoria.test" onCopied={onCopied} />,
    );

    const button = screen.getByTestId('sim-config-copy');
    await waitFor(() => {
      expect(button).toBeEnabled();
    });
    expect(screen.getByTestId('sim-config-link')).toHaveValue('');

    await user.click(button);
    expect(writeText).not.toHaveBeenCalled();
    expect(onCopied).toHaveBeenCalledWith(false, 'tooLong');
    vi.unstubAllGlobals();
  });

  it('el campo es de solo lectura, para poder copiarlo a mano sin editarlo', async () => {
    render(<ShareLink config={CONFIG} origin="https://trayectoria.test" onCopied={vi.fn()} />);
    const field = screen.getByTestId('sim-config-link');
    await waitFor(() => {
      expect(field).not.toHaveValue('');
    });
    expect(field).toHaveAttribute('readonly');
  });
});
