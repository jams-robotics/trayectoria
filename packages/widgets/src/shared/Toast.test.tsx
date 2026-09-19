import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { TOAST_TIMEOUT_MS, Toast } from './Toast';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** The toast listens on `document`, so the key is dispatched there, not on a focused node. */
function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
}

describe('Toast (F2-11)', () => {
  test('announces its message in a polite live region', () => {
    render(<Toast message="Parámetros de Mi robot aplicados" onClose={vi.fn()} />);

    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Parámetros de Mi robot aplicados');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(toast).toHaveAttribute('data-tone', 'success');
  });

  test('closes itself after 5 s (docs/DESIGN.md §5, Toast)', () => {
    const onClose = vi.fn();
    render(<Toast message="Guardado" onClose={onClose} />);

    expect(TOAST_TIMEOUT_MS).toBe(5000);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TOAST_TIMEOUT_MS);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('closes with Escape', () => {
    const onClose = vi.fn();
    render(<Toast message="Guardado" onClose={onClose} />);

    press('Escape');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('ignores keys other than Escape', () => {
    const onClose = vi.fn();
    render(<Toast message="Guardado" onClose={onClose} />);

    press('Enter');

    expect(onClose).not.toHaveBeenCalled();
  });

  test('paints the error tone when asked', () => {
    render(<Toast message="No se pudo guardar" tone="error" onClose={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'error');
  });
});
