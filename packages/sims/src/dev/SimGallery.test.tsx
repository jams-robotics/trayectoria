import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { SimGallery, sectionsFor, stories } from './SimGallery';

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
});
