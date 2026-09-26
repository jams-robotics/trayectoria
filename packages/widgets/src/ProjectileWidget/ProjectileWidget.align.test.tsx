import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { ProjectileWidget } from './ProjectileWidget';

/** The header rows of the parameter panels, in reading order (#381). */
function headers(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-params-header]'));
}

describe('ProjectileWidget · panels A and B aligned (#381)', () => {
  test('the toggle of B sits in the header of B, on the line of its legend', () => {
    render(<ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} overlay />);
    const toggle = screen.getByRole('button', { name: 'Mostrar caída B' });
    const [headerA, headerB] = headers();
    expect(headers()).toHaveLength(2);
    expect(headerA).toHaveTextContent('Caída A');
    expect(headerB).toHaveTextContent('Caída B');
    expect(headerB).toContainElement(toggle);
    expect(headerA).not.toContainElement(toggle);
  });

  test('both headers keep the height of the toggle, so both panels start at the same line', () => {
    render(<ProjectileWidget mode="launch" initial={{ v0_mps: 4, h_m: 0 }} overlay />);
    const [headerA, headerB] = headers();
    expect(headerA?.className).toBe(headerB?.className);
    expect(headerA).toHaveClass('min-h-10');
  });

  test('with B hidden the toggle keeps its place in the header row of B', async () => {
    const user = userEvent.setup();
    render(<ProjectileWidget mode="drop" initial={{ h_m: 0.25 }} overlay />);
    const toggle = screen.getByRole('button', { name: 'Mostrar caída B' });
    await user.click(toggle);
    const [headerA, headerB] = headers();
    // The same button, so the keyboard focus stays on it.
    expect(headerB).toContainElement(toggle);
    expect(toggle).toHaveFocus();
    expect(headerB).not.toHaveTextContent('Caída B');
    expect(headerA?.className).toBe(headerB?.className);
  });
});
