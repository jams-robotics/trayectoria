import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { ManualControls, ManualHelp, ManualViewer } from './ManualControls';
import { MANUAL_DIFF_RADPS, commandOf } from './useManualKeyboard';
import type { ManualDrive, ManualKey } from './useManualKeyboard';

// F4-04 (#130, decisión 3): los botones táctiles aplican y sueltan las mismas direcciones que el
// teclado, con `pointerdown` y `pointerup`.

/** Un mando de prueba que solo registra las direcciones pulsadas y soltadas. */
function driveSpy(): {
  drive: ManualDrive;
  press: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  const press = vi.fn<(key: ManualKey) => void>();
  const release = vi.fn<(key: ManualKey) => void>();
  return {
    drive: { omegaBase_radps: 0, diff_radps: 0, command: commandOf(0, 0), press, release },
    press,
    release,
  };
}

describe('ManualControls (F4-04)', () => {
  it('dibuja los cuatro botones de 44 px con su etiqueta', () => {
    render(<ManualControls drive={driveSpy().drive} />);
    for (const key of ['up', 'down', 'left', 'right'] as const) {
      const button = screen.getByTestId(`manual-${key}`);
      expect(button).toHaveAttribute('aria-label');
      expect(button.getAttribute('aria-label')).not.toBe('');
      expect(button).toHaveStyle({ width: '44px', height: '44px' });
    }
  });

  it('pulsa con pointerdown y suelta con pointerup', () => {
    const { drive, press, release } = driveSpy();
    render(<ManualControls drive={drive} />);

    fireEvent.pointerDown(screen.getByTestId('manual-right'));
    expect(press).toHaveBeenCalledWith('right');
    fireEvent.pointerUp(screen.getByTestId('manual-right'));
    expect(release).toHaveBeenCalledWith('right');
  });

  it('suelta también con pointercancel y al salir del botón', () => {
    const { drive, release } = driveSpy();
    render(<ManualControls drive={drive} />);

    fireEvent.pointerCancel(screen.getByTestId('manual-left'));
    fireEvent.pointerLeave(screen.getByTestId('manual-left'));
    expect(release).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledWith('left');
  });

  it('↑ sube la velocidad base', () => {
    const { drive, press } = driveSpy();
    render(<ManualControls drive={drive} />);

    fireEvent.pointerDown(screen.getByTestId('manual-up'));
    expect(press).toHaveBeenCalledWith('up');
  });

  it('el pad está agrupado y etiquetado', () => {
    render(<ManualControls drive={driveSpy().drive} />);
    expect(screen.getByRole('group')).toHaveAccessibleName();
  });
});

describe('ManualHelp (F4-04)', () => {
  it('muestra la ayuda de interacción en mono xs', () => {
    render(<ManualHelp />);
    const help = screen.getByTestId('manual-help');
    expect(help).toBeVisible();
    expect(help.className).toContain('font-mono');
    expect(help.className).toContain('text-xs');
    expect(help.textContent).toContain(String(MANUAL_DIFF_RADPS));
  });

  it('el visor enfocable es un grupo con nombre, con y sin modo manual (F7-01)', () => {
    const { drive } = driveSpy();
    const viewerRef = { current: null };
    const { rerender } = render(
      <ManualViewer viewerRef={viewerRef} manual={false} drive={drive}>
        <canvas />
      </ManualViewer>,
    );
    const idle = screen.getByTestId('line-follower-viewport');
    expect(idle).toHaveAttribute('role', 'group');
    expect(idle).toHaveAccessibleName(/\S/);
    rerender(
      <ManualViewer viewerRef={viewerRef} manual drive={drive}>
        <canvas />
      </ManualViewer>,
    );
    const viewer = screen.getByTestId('line-follower-viewport');
    expect(viewer).toHaveAttribute('role', 'group');
    expect(viewer).toHaveAttribute('aria-label');
  });
});
