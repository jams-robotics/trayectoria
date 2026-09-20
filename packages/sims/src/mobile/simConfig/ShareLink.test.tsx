import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('el campo es de solo lectura, para poder copiarlo a mano sin editarlo', async () => {
    render(<ShareLink config={CONFIG} origin="https://trayectoria.test" onCopied={vi.fn()} />);
    const field = screen.getByTestId('sim-config-link');
    await waitFor(() => {
      expect(field).not.toHaveValue('');
    });
    expect(field).toHaveAttribute('readonly');
  });
});
