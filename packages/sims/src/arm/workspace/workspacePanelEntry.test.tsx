import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { t } from '@trayectoria/i18n';
import type { ArmSpec } from '@trayectoria/robot-spec';
import { describe, expect, test, vi } from 'vitest';

import { workspacePanel, workspaceSummary } from './workspacePanelEntry';

// F5-03 (#136, decision 4): the entry that `ArmViewer` puts into its panel column. Same
// contract as the panels of F5-01b and F5-02, so that the page collapses them the same way on mobile.

/** Minimal arm: the entry only passes it to the panel, it does not sample it here. */
const ARM: ArmSpec = {
  baseLink: 'base_link',
  endEffectorLink: 'tool0',
  links: [{ name: 'base_link' }, { name: 'tool0' }],
  joints: [
    {
      name: 'joint1',
      type: 'revolute',
      parent: 'base_link',
      child: 'tool0',
      origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
      axis: [0, 0, 1],
      limits: { lower: -Math.PI, upper: Math.PI },
    },
  ],
};

describe('workspacePanel (F5-03)', () => {
  test('lleva el id, el título y el resumen del panel', () => {
    const panel = workspacePanel(ARM, t, vi.fn());

    expect(panel.id).toBe('workspace');
    expect(panel.title).toBe(t('sims.workspace.title'));
    expect(panel.summary).toBe(workspaceSummary(t));
  });

  test('su contenido es el panel del espacio de trabajo', () => {
    render(<>{workspacePanel(ARM, t, vi.fn()).content}</>);

    expect(screen.getByTestId('workspace-panel')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-compute')).toHaveTextContent(t('sims.workspace.compute'));
  });

  test('los mandos van en su propia tarjeta, como las articulaciones (#383)', () => {
    render(<>{workspacePanel(ARM, t, vi.fn()).content}</>);
    const card = screen.getByTestId('workspace-card');
    expect(card.className).toContain('rounded-lg');
    expect(card.className).toContain('bg-bg-raised');
    expect(card).toContainElement(screen.getByTestId('workspace-compute'));
  });
});
