import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { t } from '@trayectoria/i18n';
import { describe, expect, test, vi } from 'vitest';

import { EffectorPanel, effectorRows, effectorSummary } from './EffectorPanel';
import { FramesToggle } from './FramesToggle';
import { ARM_TOKENS, armToken, readArmColors } from './armColors';
import type { EffectorReadout } from './types';

/** El panel con q = (90°, 0) del brazo plano: valores dorados del ticket. */
const GOLDEN_READOUT: EffectorReadout = {
  x_m: '0.000',
  y_m: '0.350',
  z_m: '0.000',
  roll_deg: '0.0',
  pitch_deg: '0.0',
  yaw_deg: '90.0',
};

describe('EffectorPanel (F5-01a)', () => {
  test('muestra los seis valores dorados con su unidad', () => {
    render(<EffectorPanel readout={GOLDEN_READOUT} />);
    expect(screen.getByTestId('sims.arm.x')).toHaveTextContent('0.000');
    expect(screen.getByTestId('sims.arm.y')).toHaveTextContent('0.350');
    expect(screen.getByTestId('sims.arm.z')).toHaveTextContent('0.000');
    expect(screen.getByTestId('sims.arm.yaw')).toHaveTextContent('90.0');
    expect(screen.getAllByText('m')).toHaveLength(3);
    expect(screen.getAllByText('°')).toHaveLength(3);
  });

  test('las filas van en el orden x, y, z, alabeo, cabeceo, guiñada', () => {
    expect(effectorRows(GOLDEN_READOUT).map((row) => row.labelKey)).toEqual([
      'sims.arm.x',
      'sims.arm.y',
      'sims.arm.z',
      'sims.arm.roll',
      'sims.arm.pitch',
      'sims.arm.yaw',
    ]);
  });

  test('anuncia el estado en una región viva, sin literales en el componente', () => {
    render(<EffectorPanel readout={GOLDEN_READOUT} />);
    const live = screen.getByText(effectorSummary(GOLDEN_READOUT, t));
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live.textContent).toContain('0.350');
    expect(screen.getByTestId('effector-panel')).toHaveAttribute(
      'aria-label',
      t('sims.arm.effector'),
    );
  });
});

describe('FramesToggle (F5-01a)', () => {
  test('refleja y alterna el estado de los marcos', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<FramesToggle visible={false} onToggle={onToggle} />);
    const button = screen.getByTestId('frames-toggle');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('aria-label', t('sims.arm.frames'));
    button.click();
    expect(onToggle).toHaveBeenCalledWith(true);

    rerender(<FramesToggle visible onToggle={onToggle} />);
    expect(screen.getByTestId('frames-toggle')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('armColors (F5-01a)', () => {
  test('usa los tokens de docs/DESIGN.md §6', () => {
    expect(ARM_TOKENS).toEqual({
      base: '--color-fg-muted',
      link: '--color-physical',
      joint: '--color-fg',
      // F5-02 (#135, decisión 4): el eslabón elegido en el panel de matrices se marca `primary`.
      highlight: '--color-primary',
    });
  });

  test('cae al valor claro del token cuando no hay hoja de estilos', () => {
    expect(readArmColors(null)).toEqual({
      base: '#526475',
      link: '#a25607',
      joint: '#1a242f',
      highlight: '#0d6a8e',
    });
  });

  test('lee el valor del token del documento cuando lo hay', () => {
    const spy = vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name: string) => (name === '--color-physical' ? ' #f0a742 ' : ''),
    } as unknown as CSSStyleDeclaration);
    expect(armToken(document.documentElement, ARM_TOKENS.link)).toBe('#f0a742');
    // Un token que la hoja no define sigue cayendo a su valor claro.
    expect(armToken(document.documentElement, ARM_TOKENS.base)).toBe('#526475');
    expect(armToken(document.documentElement, '--color-inventado')).toBe('');
    spy.mockRestore();
  });
});
