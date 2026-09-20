import '@testing-library/jest-dom/vitest';
import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';

// La sección perezosa `ArmViewer` monta `Scene3D`, que en jsdom no tiene WebGL ni
// `ResizeObserver` (F2-12, #96, decisión 6): se sustituye por marcadores, como en
// `arm/ArmViewer.test.tsx`. Aquí solo se comprueba que la sección se resuelve y en qué orden.
vi.mock('@trayectoria/widgets/scene3d', () => ({
  Scene3D: ({ children }: { children: ReactNode }): ReactNode => (
    <div data-testid="canvas">{children}</div>
  ),
  Frame: (): ReactNode => <div data-testid="frame" />,
}));

import { SimGallery, includesArmViewer, sectionsFor, stories } from './SimGallery';

// F4-01b, decisión 2 de #126: `/dev/sims` repite el patrón de `/dev/widgets` tras el PR #140 —
// filtro `?section=` leído en `apps/web` y la misma convención `data-section` / `data-story`,
// de modo que una captura visual se toma sobre una página que solo lleva su propia sección.
describe('sims catalogue (F4-01b)', () => {
  test("orders each section's stories per its declared `default.order`", () => {
    expect(stories).toEqual([
      {
        title: 'TrackEditor',
        stories: [
          ['Empty', expect.any(Function)],
          ['Oval', expect.any(Function)],
          ['SCurve', expect.any(Function)],
          ['TightCurves', expect.any(Function)],
          ['Crossing', expect.any(Function)],
          ['Selected', expect.any(Function)],
        ],
      },
      {
        title: 'LineFollowerWidget',
        stories: [
          ['Oval', expect.any(Function)],
          ['Compact', expect.any(Function)],
        ],
      },
    ]);
  });

  test('renders the same story order on every call, matching `stories`', () => {
    const namesOf = (container: HTMLElement): readonly string[] =>
      Array.from(container.querySelectorAll('[data-story]')).map(
        (element) => element.getAttribute('data-story') ?? '',
      );
    const expected = stories.flatMap(({ stories: cases }) => cases.map(([name]) => name));
    const { container: first } = render(<SimGallery />);
    const { container: second } = render(<SimGallery />);
    expect(namesOf(first)).toEqual(expected);
    expect(namesOf(second)).toEqual(expected);
  });

  test('renders only the requested section', () => {
    const { container } = render(<SimGallery section="TrackEditor" />);
    const titles = Array.from(container.querySelectorAll('[data-section]')).map((element) =>
      element.getAttribute('data-section'),
    );
    expect(titles).toEqual(['TrackEditor']);
  });

  // `null` is what `URLSearchParams.get` returns for a parameter that is not in the URL, so it
  // is the value `/dev/sims` passes when nobody asked for a section.
  test('renders the whole catalogue without a section, with null and with an empty one', () => {
    const all = stories.map(({ title }) => title);
    expect(sectionsFor(undefined).map(({ title }) => title)).toEqual(all);
    expect(sectionsFor(null).map(({ title }) => title)).toEqual(all);
    expect(sectionsFor('').map(({ title }) => title)).toEqual(all);
    const { container } = render(<SimGallery />);
    const titles = Array.from(container.querySelectorAll('[data-section]')).map(
      (element) => element.getAttribute('data-section') ?? '',
    );
    expect(titles).toEqual(all);
  });

  test('renders nothing for a section that is not in the catalogue', () => {
    expect(sectionsFor('NoSuchSim')).toEqual([]);
    const { container } = render(<SimGallery section="NoSuchSim" />);
    expect(container.querySelectorAll('[data-section]')).toHaveLength(0);
  });

  // F5-01a (#133, decisión 2): la sección `ArmViewer` se carga con `React.lazy` para que `three`
  // y `urdf-loader` no entren en el chunk principal del playground. No aparece en `stories`, que
  // solo lista las secciones importadas de forma estática.
  test('keeps the lazy `ArmViewer` section out of the static catalogue', () => {
    expect(stories.map(({ title }) => title)).not.toContain('ArmViewer');
    expect(includesArmViewer(undefined)).toBe(true);
    expect(includesArmViewer(null)).toBe(true);
    expect(includesArmViewer('')).toBe(true);
    expect(includesArmViewer('ArmViewer')).toBe(true);
    expect(includesArmViewer('TrackEditor')).toBe(false);
  });

  test('resolves the lazy `ArmViewer` section when it is the one requested', async () => {
    const { container } = render(<SimGallery section="ArmViewer" />);
    await waitFor(() => {
      expect(container.querySelector('[data-section="ArmViewer"]')).not.toBeNull();
    });
    const names = Array.from(container.querySelectorAll('[data-story]')).map(
      (element) => element.getAttribute('data-story') ?? '',
    );
    expect(names).toEqual(['Planar', 'So101']);
  });
});
