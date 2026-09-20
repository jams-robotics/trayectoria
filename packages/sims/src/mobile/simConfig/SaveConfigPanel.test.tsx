import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@trayectoria/i18n';
import { REFERENCE_PID_PARAMS } from '@trayectoria/sim-core';
import type { SimConfig } from '@trayectoria/robot-spec';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SaveConfigPanel } from './SaveConfigPanel';
import { decode } from './codec';

// F4-05 (#131, decisión 6): el panel «Guardar y compartir». El panel no guarda nada por su
// cuenta: lo que se comprueba es que el nombre, la lista y el enlace llaman a la página con lo
// que corresponde.

const ORIGIN = 'https://trayectoria.test';

/** La configuración en curso: óvalo, PID de referencia y semilla 1 (valores dorados). */
const CURRENT: Omit<SimConfig, 'id' | 'name'> = {
  track: { preset: 'oval' },
  controller: 'pid',
  params: { ...REFERENCE_PID_PARAMS },
  seed: 1,
};

const SAVED: readonly SimConfig[] = [
  { id: 'cfg-1', name: 'Óvalo rápido', ...CURRENT },
  { id: 'cfg-2', name: 'Curva en S', ...CURRENT, controller: 'p' },
];

function setup(saved: readonly SimConfig[] = []): {
  onSave: ReturnType<typeof vi.fn>;
  onLoad: ReturnType<typeof vi.fn>;
  onDelete: ReturnType<typeof vi.fn>;
  onCopied: ReturnType<typeof vi.fn>;
} {
  const handlers = {
    onSave: vi.fn(),
    onLoad: vi.fn(),
    onDelete: vi.fn(),
    onCopied: vi.fn(),
  };
  render(<SaveConfigPanel current={CURRENT} saved={saved} origin={ORIGIN} {...handlers} />);
  return handlers;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('SaveConfigPanel (F4-05)', () => {
  it('«Guardar» está deshabilitado sin nombre y entrega el nombre y la configuración', async () => {
    const user = userEvent.setup();
    const { onSave } = setup();
    const save = screen.getByTestId('sim-config-save');
    expect(save).toBeDisabled();

    await user.type(screen.getByTestId('sim-config-name'), 'Óvalo rápido');
    expect(save).toBeEnabled();
    await user.click(save);

    expect(onSave).toHaveBeenCalledWith('Óvalo rápido', CURRENT);
    // El campo queda listo para la siguiente, sin el nombre anterior.
    expect(screen.getByTestId('sim-config-name')).toHaveValue('');
  });

  it('sin configuraciones guardadas muestra el aviso y ninguna fila', () => {
    setup();
    expect(screen.getByText(t('sims.simConfig.empty'))).toBeInTheDocument();
    expect(screen.queryByTestId('sim-config-list')).not.toBeInTheDocument();
  });

  it('«Cargar» entrega la configuración de esa fila', async () => {
    const user = userEvent.setup();
    const { onLoad } = setup(SAVED);
    await user.click(screen.getAllByTestId('sim-config-load')[1] as HTMLElement);
    expect(onLoad).toHaveBeenCalledWith(SAVED[1]);
  });

  it('«Borrar» pide confirmación en línea y solo entonces borra', async () => {
    const user = userEvent.setup();
    const { onDelete } = setup(SAVED);

    await user.click(screen.getAllByTestId('sim-config-delete')[0] as HTMLElement);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(t('sims.simConfig.confirmDelete'))).toBeInTheDocument();

    await user.click(screen.getByTestId('sim-config-delete-confirm'));
    expect(onDelete).toHaveBeenCalledWith('cfg-1');
  });

  it('cancelar la confirmación no borra nada', async () => {
    const user = userEvent.setup();
    const { onDelete } = setup(SAVED);
    await user.click(screen.getAllByTestId('sim-config-delete')[0] as HTMLElement);
    await user.click(screen.getByTestId('sim-config-delete-cancel'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sim-config-delete-confirm')).not.toBeInTheDocument();
  });

  it('el enlace reproduce la configuración en curso y «Copiar enlace» lo copia', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const { onCopied } = setup();

    const field = screen.getByTestId('sim-config-link');
    await waitFor(() => {
      expect(field).not.toHaveValue('');
    });
    const link = (field as HTMLInputElement).value;
    expect(link.startsWith(`${ORIGIN}/simuladores/movil?c=`)).toBe(true);

    // Lo que viaja en el enlace es la configuración en curso, no una copia aproximada.
    const text = new URL(link).searchParams.get('c') ?? '';
    const decoded = await decode(text);
    expect(decoded.ok && decoded.value).toMatchObject(CURRENT);

    await user.click(screen.getByTestId('sim-config-copy'));
    expect(writeText).toHaveBeenCalledWith(link);
    await waitFor(() => {
      expect(onCopied).toHaveBeenCalledWith(true);
    });
    vi.unstubAllGlobals();
  });

  it('un portapapeles que rechaza avisa del fallo y deja el enlace a la vista', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('denegado'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const { onCopied } = setup();

    const field = screen.getByTestId('sim-config-link');
    await waitFor(() => {
      expect(field).not.toHaveValue('');
    });
    await user.click(screen.getByTestId('sim-config-copy'));
    await waitFor(() => {
      expect(onCopied).toHaveBeenCalledWith(false);
    });
    expect(field).not.toHaveValue('');
    vi.unstubAllGlobals();
  });
});
